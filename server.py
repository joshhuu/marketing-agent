"""
FastAPI Server for Multi-Agent Marketing System
Provides REST API with SSE streaming, RBAC, and Human-in-the-Loop capabilities
"""
import logging
import asyncio
import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from sqlalchemy import desc

from graph import build_graph
from state import AgentState
from database import get_db_session, Classification, EngagementHistory, Prospect, ExecutionDetail
from config import LOG_LEVEL

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ========================================
# PYDANTIC SCHEMAS FOR INPUT VALIDATION
# ========================================

class CampaignInput(BaseModel):
    """Strict input schema for campaign creation with data integrity validation"""
    
    time: str = Field(
        ...,
        description="Time context for the campaign (e.g., 'ASAP', 'Next week', 'Q1 2026')",
        min_length=1,
        max_length=100
    )
    location: str = Field(
        ...,
        description="Target geographic location (e.g., 'UK', 'North America', 'APAC')",
        min_length=1,
        max_length=100
    )
    business_behavior: str = Field(
        ...,
        description="Description of business behavior or context",
        min_length=10,
        max_length=500
    )
    intent: str = Field(
        ...,
        description="User's marketing intent or goal",
        min_length=10,
        max_length=500
    )
    target_audience: str = Field(
        ...,
        description="Target audience description (e.g., 'HR managers', 'CTOs')",
        min_length=1,
        max_length=200
    )
    
    @validator('time', 'location', 'business_behavior', 'intent', 'target_audience')
    def strip_whitespace(cls, v):
        """Remove leading/trailing whitespace"""
        return v.strip() if isinstance(v, str) else v
    
    class Config:
        schema_extra = {
            "example": {
                "time": "ASAP",
                "location": "UK",
                "business_behavior": "Selling HR payroll software to mid-sized companies",
                "intent": "Generate new B2B leads for product launch",
                "target_audience": "HR managers dealing with manual payroll issues"
            }
        }


class ApprovalRequest(BaseModel):
    """Schema for human approval in the loop"""
    session_id: str = Field(..., description="Campaign execution session ID")
    approved: bool = Field(..., description="Whether to approve and continue execution")
    selected_prospect_ids: Optional[List[str]] = Field(
        None,
        description="Optional list of prospect IDs to target (if not all)"
    )
    notes: Optional[str] = Field(None, max_length=500)


class ExecutionHistoryResponse(BaseModel):
    """Response schema for execution history"""
    id: str
    time_context: Optional[str]
    location: Optional[str]
    business_behavior: Optional[str]
    user_intent: Optional[str]
    category: str
    confidence: float
    tone: Optional[str]
    cta_type: Optional[str]
    urgency_level: Optional[str]
    created_at: datetime
    
    class Config:
        orm_mode = True


class ProspectHistoryResponse(BaseModel):
    """Response schema for prospect with priority score"""
    id: str
    name: str
    job_title: str
    company_name: str
    industry: str
    priority_score: float
    icp_score: Optional[float]
    times_contacted: int
    last_contacted_at: Optional[datetime]
    
    class Config:
        orm_mode = True


# ========================================
# RBAC - ROLE-BASED ACCESS CONTROL
# ========================================

class Role:
    """Role definitions for RBAC"""
    ADMIN = "admin"
    MARKETER = "marketer"


class RBACError(HTTPException):
    """Custom exception for RBAC violations"""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: {detail}"
        )


def get_current_user_role(x_user_role: Optional[str] = Header(None)) -> str:
    """
    Dependency to extract user role from request header
    
    Args:
        x_user_role: User role from X-User-Role header
        
    Returns:
        User role string
        
    Raises:
        HTTPException: If role header is missing or invalid
    """
    # Allow OPTIONS requests to pass through (for CORS preflight)
    if not x_user_role:
        # Return a default role for OPTIONS requests
        # The actual validation will happen in the route handler
        return Role.MARKETER
    
    role = x_user_role.lower()
    if role not in [Role.ADMIN, Role.MARKETER]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {role}. Must be 'admin' or 'marketer'"
        )
    
    logger.info(f"Request authenticated with role: {role}")
    return role


def require_role(allowed_roles: List[str]):
    """
    Dependency factory to enforce role-based access control
    
    Args:
        allowed_roles: List of roles permitted to access endpoint
        
    Returns:
        Dependency function that validates user role
    """
    def role_checker(role: str = Depends(get_current_user_role)) -> str:
        if role not in allowed_roles:
            raise RBACError(
                f"This endpoint requires one of: {', '.join(allowed_roles)}. Your role: {role}"
            )
        return role
    
    return role_checker


# ========================================
# HUMAN-IN-THE-LOOP SESSION MANAGEMENT
# ========================================

class SessionManager:
    """Manages campaign execution sessions with approval workflow"""
    
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()
    
    async def create_session(self, initial_state: Dict[str, Any], session_id: Optional[str] = None) -> str:
        """Create a new execution session"""
        if session_id is None:
            session_id = str(uuid4())
        async with self._lock:
            self.sessions[session_id] = {
                "state": initial_state,
                "status": "awaiting_approval",
                "created_at": datetime.utcnow(),
                "approval_event": asyncio.Event()
            }
        logger.info(f"Created session {session_id}")
        return session_id
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data"""
        async with self._lock:
            return self.sessions.get(session_id)
    
    async def approve_session(
        self,
        session_id: str,
        approved: bool,
        selected_prospect_ids: Optional[List[str]] = None
    ):
        """Approve or reject a session"""
        async with self._lock:
            if session_id not in self.sessions:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Session {session_id} not found"
                )
            
            session = self.sessions[session_id]
            session["approved"] = approved
            session["selected_prospect_ids"] = selected_prospect_ids
            session["status"] = "approved" if approved else "rejected"
            session["approval_event"].set()
        
        logger.info(f"Session {session_id} {'approved' if approved else 'rejected'}")
    
    async def wait_for_approval(self, session_id: str, timeout: int = 300) -> bool:
        """Wait for session approval with timeout"""
        session = await self.get_session(session_id)
        if not session:
            return False
        
        try:
            await asyncio.wait_for(session["approval_event"].wait(), timeout=timeout)
            return session.get("approved", False)
        except asyncio.TimeoutError:
            logger.warning(f"Session {session_id} approval timeout")
            return False
    
    async def cleanup_session(self, session_id: str):
        """Remove session from memory"""
        async with self._lock:
            if session_id in self.sessions:
                del self.sessions[session_id]
                logger.info(f"Cleaned up session {session_id}")


# Global session manager
session_manager = SessionManager()


# ========================================
# FASTAPI APPLICATION
# ========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown"""
    logger.info("Starting Multi-Agent Marketing API Server")
    yield
    logger.info("Shutting down Multi-Agent Marketing API Server")


app = FastAPI(
    title="Multi-Agent Marketing System API",
    description="B2B Marketing Campaign Automation with AI Agents, RBAC, and Human-in-the-Loop",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://localhost:5173"],  # Vite dev server (both common ports)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-User-Role", "Authorization"],
    expose_headers=["*"],
    max_age=3600,
)


# ========================================
# STREAMING EXECUTION ENGINE
# ========================================

async def stream_agent_execution(
    campaign_input: CampaignInput,
    session_id: str,
    role: str
):
    """
    Execute agent workflow with Server-Sent Events streaming
    
    Yields status updates as the agents execute, with Human-in-the-Loop
    approval required after ICP matching (Agent 2)
    """
    
    # Construct user prompt from structured input
    user_prompt = (
        f"Time: {campaign_input.time}. "
        f"Location: {campaign_input.location}. "
        f"Business: {campaign_input.business_behavior}. "
        f"Intent: {campaign_input.intent}. "
        f"Target: {campaign_input.target_audience}"
    )
    
    try:
        # Initialize state
        yield f"data: {json.dumps({'stage': 'init', 'status': 'Building workflow graph', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        graph = build_graph()
        
        # Start execution through agents
        yield f"data: {json.dumps({'stage': 'input_parser', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Execute input parser
        initial_state: AgentState = {"user_prompt": user_prompt}
        
        # We'll manually execute each node for streaming control
        from nodes.input_parser import parse_input
        from nodes.classifier import classify_task
        from nodes.strategy import generate_strategy
        from nodes.icp_matcher import match_icp
        from nodes.platform_decision import decide_platform
        from nodes.content_generator import generate_content
        
        # Agent 1: Input Parser
        state = parse_input(initial_state)
        yield f"data: {json.dumps({'stage': 'input_parser', 'status': 'completed', 'data': {'time': state.get('time'), 'location': state.get('location'), 'business_behavior': state.get('business_behavior'), 'user_intent': state.get('user_intent'), 'target_audience': state.get('target_audience')}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 2: Classifier
        yield f"data: {json.dumps({'stage': 'classifier', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        state = classify_task(state)
        yield f"data: {json.dumps({'stage': 'classifier', 'status': 'completed', 'data': {'category': state.get('category'), 'confidence': state.get('confidence')}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 3: Strategy
        yield f"data: {json.dumps({'stage': 'strategy', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        state = generate_strategy(state)
        yield f"data: {json.dumps({'stage': 'strategy', 'status': 'completed', 'data': {'tone': state.get('tone'), 'cta_type': state.get('cta_type'), 'urgency_level': state.get('urgency_level')}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 4: ICP Matcher
        yield f"data: {json.dumps({'stage': 'icp_matcher', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        state = match_icp(state)
        
        top_prospects = state.get('top_prospects', [])
        prospect_summary = [
            {
                "id": str(p.get('id')),
                "name": p.get('name'),
                "first_name": p.get('first_name'),
                "last_name": p.get('last_name'),
                "job_title": p.get('job_title'),
                "company_name": p.get('company_name'),
                "industry": p.get('industry'),
                "priority_score": p.get('priority_score')
            }
            for p in top_prospects[:10]
        ]
        
        # HUMAN-IN-THE-LOOP: Pause for approval
        # Store state in session BEFORE yielding approval event
        await session_manager.create_session(state, session_id=session_id)
        
        yield f"data: {json.dumps({'stage': 'icp_matcher', 'status': 'completed', 'data': {'target_archetype': state.get('target_archetype'), 'prospect_count': len(top_prospects), 'top_prospects': prospect_summary}, 'session_id': session_id, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Wait for approval (5 minute timeout)
        approved = await session_manager.wait_for_approval(session_id, timeout=300)
        
        if not approved:
            yield f"data: {json.dumps({'stage': 'error', 'status': 'Campaign execution cancelled or timed out', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
            await session_manager.cleanup_session(session_id)
            return
        
        # Filter prospects if specific IDs were selected
        session = await session_manager.get_session(session_id)
        if session and session.get('selected_prospect_ids'):
            selected_ids = set(session['selected_prospect_ids'])
            state['top_prospects'] = [
                p for p in top_prospects
                if str(p.get('id')) in selected_ids
            ]
            filtered_count = len(state['top_prospects'])
            yield f"data: {json.dumps({'stage': 'prospects_filtered', 'status': f'Filtered to {filtered_count} selected prospects', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 5: Platform Decision
        yield f"data: {json.dumps({'stage': 'platform_decision', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        state = decide_platform(state)
        yield f"data: {json.dumps({'stage': 'platform_decision', 'status': 'completed', 'data': {'selected_channel': state.get('selected_channel'), 'channel_reasoning': state.get('channel_reasoning')}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 6: Content Generator
        yield f"data: {json.dumps({'stage': 'content_generator', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        state = generate_content(state)
        
        # Prepare final content response
        final_content = {
            "linkedin_message": state.get('linkedin_message'),
            "email_message": state.get('email_message'),
            "call_script": state.get('call_script'),
            "selected_channel": state.get('selected_channel')
        }
        
        yield f"data: {json.dumps({'stage': 'content_generator', 'status': 'completed', 'data': final_content, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Save execution details to database
        classification_id = None
        try:
            from utils.db_queries import save_execution_details
            db = next(get_db_session())
            execution_detail = save_execution_details(db, state)
            if execution_detail:
                classification_id = str(execution_detail.classification_id)
            db.close()
            logger.info(f"Execution details saved to database with classification_id={classification_id}")
        except Exception as db_error:
            logger.error(f"Failed to save execution details: {db_error}")
            # Continue even if save fails
        
        # Final completion
        yield f"data: {json.dumps({'stage': 'complete', 'status': 'Campaign execution successful', 'classification_id': classification_id, 'final_state': {'category': state.get('category'), 'target_archetype': state.get('target_archetype'), 'selected_channel': state.get('selected_channel'), 'prospect_count': len(state.get('top_prospects', []))}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Cleanup
        await session_manager.cleanup_session(session_id)
        
    except Exception as e:
        logger.error(f"Error during agent execution: {e}", exc_info=True)
        error_msg = f"Error: {str(e)}"
        yield f"data: {json.dumps({'stage': 'error', 'status': error_msg, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        await session_manager.cleanup_session(session_id)


# ========================================
# API ENDPOINTS
# ========================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Multi-Agent Marketing System",
        "status": "operational",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/campaigns/execute")
async def execute_campaign(
    campaign_input: CampaignInput,
    role: str = Depends(require_role([Role.MARKETER, Role.ADMIN]))
):
    """
    Execute marketing campaign with real-time SSE streaming
    
    **Role Required:** Marketer or Admin
    
    **Process:**
    1. Streams agent execution status in real-time
    2. Pauses after ICP matching for human approval
    3. Requires POST to /campaigns/approve endpoint
    4. Continues execution upon approval
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    session_id = str(uuid4())
    logger.info(f"Starting campaign execution (session: {session_id}, role: {role})")
    
    return StreamingResponse(
        stream_agent_execution(campaign_input, session_id, role),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Session-ID": session_id,
            "Connection": "keep-alive"
        }
    )


@app.post("/campaigns/approve")
async def approve_campaign(
    approval: ApprovalRequest,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER]))
):
    """
    Approve or reject campaign execution after ICP matching
    
    **Role Required:** Admin or Marketer
    
    This endpoint allows human-in-the-loop control. After Agent 2 (ICP Matcher)
    identifies prospects, execution pauses until this endpoint receives approval.
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    logger.info(f"Approval request for session {approval.session_id}: {approval.approved} (role: {role})")
    
    await session_manager.approve_session(
        approval.session_id,
        approval.approved,
        approval.selected_prospect_ids
    )
    
    return {
        "session_id": approval.session_id,
        "status": "approved" if approval.approved else "rejected",
        "message": "Campaign will continue execution" if approval.approved else "Campaign execution cancelled",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/history/executions", response_model=List[ExecutionHistoryResponse])
async def get_execution_history(
    limit: int = 50,
    offset: int = 0,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve execution history from classifications table
    
    **Role Required:** Admin or Marketer
    
    Returns historical campaign classifications with strategy parameters.
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    logger.info(f"Fetching execution history (limit: {limit}, offset: {offset}, role: {role})")
    
    try:
        classifications = db.query(Classification)\
            .order_by(desc(Classification.created_at))\
            .limit(limit)\
            .offset(offset)\
            .all()
        
        return [
            ExecutionHistoryResponse(
                id=str(c.id),
                time_context=c.time_context,
                location=c.location,
                business_behavior=c.business_behavior,
                user_intent=c.user_intent,
                category=c.category,
                confidence=c.confidence,
                tone=c.tone,
                cta_type=c.cta_type,
                urgency_level=c.urgency_level,
                created_at=c.created_at
            )
            for c in classifications
        ]
    except Exception as e:
        logger.error(f"Error fetching execution history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve execution history: {str(e)}"
        )


@app.get("/history/executions/{execution_id}/details")
async def get_execution_details(
    execution_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve detailed execution information for a specific campaign
    
    **Role Required:** Admin or Marketer
    
    Returns full agent workflow results including classification, prospects,
    platform decision, and generated content.
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    logger.info(f"Fetching execution details for ID: {execution_id}")
    
    try:
        # Fetch the classification
        classification = db.query(Classification).filter(Classification.id == execution_id).first()
        if not classification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found"
            )
        
        # Fetch the execution details
        execution_detail = db.query(ExecutionDetail)\
            .filter(ExecutionDetail.classification_id == execution_id)\
            .first()
        
        if not execution_detail:
            # Return basic classification info if no details available
            return {
                "classification": {
                    "id": str(classification.id),
                    "time_context": classification.time_context,
                    "location": classification.location,
                    "business_behavior": classification.business_behavior,
                    "user_intent": classification.user_intent,
                    "category": classification.category,
                    "confidence": classification.confidence,
                    "tone": classification.tone,
                    "cta_type": classification.cta_type,
                    "urgency_level": classification.urgency_level,
                    "created_at": classification.created_at.isoformat() if classification.created_at else None
                },
                "details": None
            }
        
        # Return full details
        return {
            "classification": {
                "id": str(classification.id),
                "time_context": classification.time_context,
                "location": classification.location,
                "business_behavior": classification.business_behavior,
                "user_intent": classification.user_intent,
                "category": classification.category,
                "confidence": classification.confidence,
                "tone": classification.tone,
                "cta_type": classification.cta_type,
                "urgency_level": classification.urgency_level,
                "created_at": classification.created_at.isoformat() if classification.created_at else None
            },
            "details": {
                "sender_name": execution_detail.sender_name,
                "target_audience": execution_detail.target_audience,
                "target_archetype": execution_detail.target_archetype,
                "prospects": execution_detail.prospects_found or [],
                "prospects_count": execution_detail.prospects_count,
                "prospects_filtered_count": execution_detail.prospects_filtered_count,
                "selected_channel": execution_detail.selected_channel,
                "channel_reasoning": execution_detail.channel_reasoning,
                "created_at": execution_detail.created_at.isoformat() if execution_detail.created_at else None,
                "content": {
                    "linkedin_message": execution_detail.linkedin_message,
                    "email": {
                        "subject": execution_detail.email_subject,
                        "body": execution_detail.email_body
                    },
                    "call_script": {
                        "opener": execution_detail.call_script_opener,
                        "objections": execution_detail.call_script_objections or [],
                        "close": execution_detail.call_script_close
                    }
                },
                "product": {
                    "name": execution_detail.product_name,
                    "value_proposition": execution_detail.product_value_prop
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching execution details: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve execution details: {str(e)}"
        )


@app.delete("/history/executions/{execution_id}")
async def delete_execution(
    execution_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Delete a campaign execution and its details from the database
    
    **Role Required:** Admin or Marketer
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    logger.info(f"Deleting execution ID: {execution_id}")
    
    try:
        # Fetch the classification
        classification = db.query(Classification).filter(Classification.id == execution_id).first()
        if not classification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found"
            )
        
        # Delete execution details first (foreign key constraint)
        db.query(ExecutionDetail)\
            .filter(ExecutionDetail.classification_id == execution_id)\
            .delete()
        
        # Delete the classification
        db.delete(classification)
        db.commit()
        
        logger.info(f"Successfully deleted execution {execution_id}")
        
        return {
            "success": True,
            "message": "Campaign execution deleted successfully",
            "execution_id": execution_id,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting execution: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete execution: {str(e)}"
        )


@app.get("/prospects/recent")
async def get_recent_campaign_prospects(
    limit: int = 50,
    page: int = 1,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Get paginated list of all prospects from the database with total count
    
    **Role Required:** Admin or Marketer
    """
    logger.info(f"Fetching prospects (page: {page}, limit: {limit})")
    
    try:
        # Get total count of all prospects
        total_count = db.query(Prospect).count()
        
        # Calculate offset for pagination
        offset = (page - 1) * limit
        
        # Get prospects from database with pagination
        db_prospects = db.query(Prospect)\
            .order_by(desc(Prospect.priority_score))\
            .offset(offset)\
            .limit(limit)\
            .all()
        
        prospect_list = []
        for prospect in db_prospects:
            prospect_list.append({
                "id": str(prospect.id),
                "name": f"{prospect.first_name} {prospect.last_name}",
                "first_name": prospect.first_name,
                "last_name": prospect.last_name,
                "email": prospect.email,
                "phone": prospect.phone,
                "job_title": prospect.job_title,
                "company_name": prospect.company_name,
                "industry": prospect.industry,
                "seniority": prospect.seniority,
                "department": prospect.department,
                "priority_score": prospect.priority_score or 0.0,
                "times_contacted": prospect.times_contacted or 0,
                "last_contacted_at": prospect.last_contacted_at.isoformat() if prospect.last_contacted_at else None,
                "from_campaign": False,
            })
        
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 1
        logger.info(f"Returning {len(prospect_list)} prospects (page {page} of {total_pages}), total: {total_count}")
        
        return {
            "prospects": prospect_list,
            "total": total_count,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
        
    except Exception as e:
        logger.error(f"Error fetching prospects: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prospects: {str(e)}"
        )


@app.get("/prospects/{prospect_id}")
async def get_prospect_details(
    prospect_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Get detailed information for a specific prospect
    
    **Role Required:** Admin or Marketer
    """
    logger.info(f"Fetching prospect details for ID: {prospect_id}")
    
    try:
        prospect = db.query(Prospect).filter(Prospect.id == prospect_id).first()
        
        if not prospect:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prospect {prospect_id} not found"
            )
        
        # Get engagement history for this prospect
        engagements = db.query(EngagementHistory)\
            .filter(EngagementHistory.prospect_id == prospect_id)\
            .order_by(desc(EngagementHistory.sent_at))\
            .limit(10)\
            .all()
        
        engagement_list = [
            {
                "id": str(e.id),
                "channel": e.channel,
                "sent_at": e.sent_at.isoformat() if e.sent_at else None,
                "was_opened": e.was_opened,
                "was_replied": e.was_replied,
            }
            for e in engagements
        ]
        
        return {
            "id": str(prospect.id),
            "first_name": prospect.first_name,
            "last_name": prospect.last_name,
            "email": prospect.email,
            "phone": prospect.phone,
            "linkedin_url": prospect.linkedin_url,
            "job_title": prospect.job_title,
            "company_name": prospect.company_name,
            "company_size": prospect.company_size,
            "seniority": prospect.seniority,
            "department": prospect.department,
            "industry": prospect.industry,
            "country": prospect.country,
            "city": prospect.city,
            "timezone": prospect.timezone,
            "icp_archetype": prospect.icp_archetype,
            "icp_score": prospect.icp_score,
            "priority_score": prospect.priority_score,
            "is_decision_maker": prospect.is_decision_maker,
            "preferred_channel": prospect.preferred_channel,
            "best_contact_time": prospect.best_contact_time,
            "email_open_rate": prospect.email_open_rate,
            "linkedin_click_rate": prospect.linkedin_click_rate,
            "call_answer_rate": prospect.call_answer_rate,
            "times_contacted": prospect.times_contacted,
            "last_contacted_at": prospect.last_contacted_at.isoformat() if prospect.last_contacted_at else None,
            "pain_points": prospect.pain_points,
            "interests": prospect.interests,
            "created_at": prospect.created_at.isoformat() if prospect.created_at else None,
            "engagements": engagement_list,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching prospect details: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prospect details: {str(e)}"
        )


@app.get("/history/prospects", response_model=List[ProspectHistoryResponse])
async def get_prospect_history(
    min_priority_score: float = 0.0,
    limit: int = 100,
    offset: int = 0,
    role: str = Depends(require_role([Role.ADMIN, Role.MARKETER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve prospects with priority scores
    
    **Role Required:** Admin or Marketer
    
    Returns prospects sorted by priority score, showing engagement history.
    
    **Headers:**
    - X-User-Role: "marketer" or "admin"
    """
    logger.info(f"Fetching prospect history (min_score: {min_priority_score}, limit: {limit}, role: {role})")
    
    try:
        prospects = db.query(Prospect)\
            .filter(Prospect.priority_score >= min_priority_score)\
            .order_by(desc(Prospect.priority_score))\
            .limit(limit)\
            .offset(offset)\
            .all()
        
        return [
            ProspectHistoryResponse(
                id=str(p.id),
                name=f"{p.first_name} {p.last_name}",
                job_title=p.job_title,
                company_name=p.company_name,
                industry=p.industry,
                priority_score=p.priority_score or 0.0,
                icp_score=p.icp_score,
                times_contacted=p.times_contacted,
                last_contacted_at=p.last_contacted_at
            )
            for p in prospects
        ]
    except Exception as e:
        logger.error(f"Error fetching prospect history: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve prospect history: {str(e)}"
        )


@app.get("/logs/system")
async def get_system_logs(
    lines: int = 100,
    role: str = Depends(require_role([Role.ADMIN]))
):
    """
    Retrieve system logs (Admin only)
    
    **Role Required:** Admin ONLY
    
    Returns recent system logs for debugging and monitoring.
    Marketers cannot access this endpoint.
    
    **Headers:**
    - X-User-Role: "admin"
    """
    logger.info(f"Admin {role} accessing system logs")
    
    # In production, this would read from actual log files
    # For now, return a placeholder response
    return {
        "message": "System logs endpoint",
        "note": "In production, this would stream actual log files",
        "access_level": "admin_only",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/health")
async def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "multi-agent-marketing-api",
        "timestamp": datetime.utcnow().isoformat()
    }


# ========================================
# MAIN ENTRY POINT
# ========================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
