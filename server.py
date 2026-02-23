"""
FastAPI Server for Multi-Agent Marketing System
Provides REST API with SSE streaming, RBAC, and Human-in-the-Loop capabilities
"""
import logging
import asyncio
import json
import csv
import io
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, status, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field, validator
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
import hashlib
import time

from graph import build_graph
from state import AgentState
from database import get_db_session, Classification, EngagementHistory, Prospect, ExecutionDetail, APICallLog, AuditLog, SentEmail, FollowUpEmail
from database import Base, engine as db_engine
from config import LOG_LEVEL, MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT, MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD, MAILEROO_FROM_EMAIL, MAILEROO_FROM_NAME, MAILEROO_USE_TLS

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)



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
    USER = "user"  # Same as marketer, renamed for clarity
    MARKETER = "user"  # Alias for backward compatibility
    VIEWER = "viewer"  # Read-only access


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
    if role not in [Role.ADMIN, Role.USER, Role.VIEWER, "marketer"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role: {role}. Must be 'admin', 'user', or 'viewer'"
        )
    
    # Normalize 'marketer' to 'user' for consistency
    if role == "marketer":
        role = Role.USER
    
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
    try:
        Base.metadata.create_all(bind=db_engine)
        logger.info("Database tables verified/created OK")
    except Exception as e:
        logger.warning(f"DB create_all warning (non-fatal): {e}")
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
# API CALL LOGGING MIDDLEWARE
# ========================================

@app.middleware("http")
async def log_api_calls(request: Request, call_next):
    """Middleware to log all API calls for monitoring and compliance"""
    start_time = time.time()
    
    # Get user role from header
    user_role = request.headers.get("x-user-role", "anonymous")
    
    # Capture request body for prompt extraction
    request_body = None
    prompt_preview = None
    if request.method == "POST":
        try:
            body = await request.body()
            request_body = body
            # Try to extract prompt from request body
            if body:
                try:
                    body_json = json.loads(body.decode('utf-8'))
                    # Look for common prompt fields
                    for field in ['business_behavior', 'intent', 'user_intent', 'prompt']:
                        if field in body_json and body_json[field]:
                            prompt_preview = str(body_json[field])[:500]
                            break
                except:
                    pass
        except:
            pass
    
    # Process request
    response = await call_next(request)
    
    # Calculate response time
    response_time_ms = (time.time() - start_time) * 1000
    
    # Log asynchronously (don't block response)
    try:
        db = next(get_db_session())
        
        # Hash request body for privacy (don't store actual data)
        request_hash = None
        if request_body:
            request_hash = hashlib.sha256(request_body).hexdigest()
        
        api_log = APICallLog(
            endpoint=str(request.url.path),
            method=request.method,
            user_role=user_role,
            status_code=response.status_code,
            response_time_ms=response_time_ms,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent", "")[:500],
            request_body_hash=request_hash,
            prompt_preview=prompt_preview
        )
        
        db.add(api_log)
        db.commit()
        db.close()
    except Exception as e:
        logger.error(f"Failed to log API call: {e}")
        # Don't fail the request if logging fails
    
    return response


async def create_audit_log(
    db: Session,
    action: str,
    resource_type: str,
    user_role: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict] = None,
    prompt_used: Optional[str] = None,
    llm_model: Optional[str] = None,
    ip_address: Optional[str] = None
):
    """Helper function to create audit log entries"""
    try:
        audit_log = AuditLog(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_role=user_role,
            ip_address=ip_address,
            details=details,
            prompt_used=prompt_used,
            llm_model=llm_model
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        # Don't fail the operation if audit logging fails


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
        from nodes.email_sender import send_emails
        from nodes.call_sender import make_calls
        
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
        
        # Prepare final content response with personalized content
        personalized_content = state.get('personalized_content', [])
        
        final_content = {
            "personalized_content": personalized_content,  # NEW: List of personalized content per prospect
            "linkedin_message": state.get('linkedin_message'),  # Legacy field (first prospect)
            "email_message": state.get('email_message'),
            "call_script": state.get('call_script'),
            "selected_channel": state.get('selected_channel'),
            "prospect_count": len(personalized_content)  # How many prospects got personalized content
        }
        
        yield f"data: {json.dumps({'stage': 'content_generator', 'status': 'completed', 'data': final_content, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Save execution details to database BEFORE email validation
        classification_id = None
        try:
            from utils.db_queries import save_execution_details
            db = next(get_db_session())
            execution_detail = save_execution_details(db, state)
            if execution_detail:
                classification_id = str(execution_detail.classification_id)
                state['classification_id'] = classification_id  # Add to state for email_sender
            db.close()
            logger.info(f"Execution details saved to database with classification_id={classification_id}")
        except Exception as db_error:
            logger.error(f"Failed to save execution details: {db_error}")
            # Continue even if save fails
        
        # Agent 7: Email Sender (only if channel is email)
        selected_channel = state.get('selected_channel', 'email')
        if selected_channel == 'email':
            yield f"data: {json.dumps({'stage': 'email_sender', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
            state = send_emails(state)
            
            send_results = state.get('email_send_results', [])
            emails_sent_count = state.get('emails_sent_count', 0)
            send_error = state.get('send_error')
            
            send_summary = {
                'emails_sent': emails_sent_count,
                'results': send_results,
                'error': send_error
            }
            
            yield f"data: {json.dumps({'stage': 'email_sender', 'status': 'completed', 'data': send_summary, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Agent 7b: Call Sender (only if channel is call)
        elif selected_channel == 'call':
            yield f"data: {json.dumps({'stage': 'call_sender', 'status': 'started', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
            state = make_calls(state)
            
            call_results = state.get('call_send_results', [])
            calls_made_count = state.get('calls_made_count', 0)
            call_error = state.get('call_error')
            
            call_summary = {
                'calls_made': calls_made_count,
                'results': call_results,
                'error': call_error
            }
            
            yield f"data: {json.dumps({'stage': 'call_sender', 'status': 'completed', 'data': call_summary, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        else:
            yield f"data: {json.dumps({'stage': 'outreach', 'status': 'skipped', 'reason': f'Channel is {selected_channel}, no automated sending', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        # Final completion
        yield f"data: {json.dumps({'stage': 'complete', 'status': 'Campaign execution successful', 'classification_id': classification_id, 'final_state': {'category': state.get('category'), 'target_archetype': state.get('target_archetype'), 'selected_channel': state.get('selected_channel'), 'prospect_count': len(state.get('top_prospects', [])), 'emails_sent': state.get('emails_sent_count', 0), 'calls_made': state.get('calls_made_count', 0)}, 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
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
    role: str = Depends(require_role([Role.USER, Role.ADMIN]))
):
    """
    Execute marketing campaign with real-time SSE streaming
    
    **Role Required:** User or Admin
    
    **Process:**
    1. Streams agent execution status in real-time
    2. Pauses after ICP matching for human approval
    3. Requires POST to /campaigns/approve endpoint
    4. Continues execution upon approval
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    session_id = str(uuid4())
    logger.info(f"Starting campaign execution (session: {session_id}, role: {role})")
    
    # Create audit log for campaign execution
    try:
        db = next(get_db_session())
        await create_audit_log(
            db=db,
            action="campaign_execution_started",
            resource_type="campaign",
            user_role=role,
            details={"session_id": session_id},
            prompt_used=user_prompt,
            llm_model="gemini-1.5-flash"  # Update based on your config
        )
        db.close()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
    
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER]))
):
    """
    Approve or reject campaign execution after ICP matching
    
    **Role Required:** Admin or User
    
    This endpoint allows human-in-the-loop control. After Agent 2 (ICP Matcher)
    identifies prospects, execution pauses until this endpoint receives approval.
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    logger.info(f"Approval request for session {approval.session_id}: {approval.approved} (role: {role})")
    
    # Create audit log
    try:
        db = next(get_db_session())
        await create_audit_log(
            db=db,
            action="campaign_approved" if approval.approved else "campaign_rejected",
            resource_type="campaign",
            user_role=role,
            details={
                "session_id": approval.session_id,
                "selected_prospect_count": len(approval.selected_prospect_ids) if approval.selected_prospect_ids else 0
            }
        )
        db.close()
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
    
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve execution history from classifications table
    
    **Role Required:** Admin, User, or Viewer (read-only)
    
    Returns historical campaign classifications with strategy parameters.
    
    **Headers:**
    - X-User-Role: "user", "admin", or "viewer"
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve detailed execution information for a specific campaign
    
    **Role Required:** Admin, User, or Viewer (read-only)
    
    Returns full agent workflow results including classification, prospects,
    platform decision, and generated content.
    
    **Headers:**
    - X-User-Role: "user", "admin", or "viewer"
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
                "personalized_content": execution_detail.personalized_content or [],  # NEW: Personalized content for each prospect
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Delete a campaign execution and its details from the database
    
    **Role Required:** Admin or User (Viewers cannot delete)
    
    **Headers:**
    - X-User-Role: "user" or "admin"
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


@app.get("/history/executions/{execution_id}/linkedin-report")
async def download_linkedin_report(
    execution_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Generate and download a LinkedIn Outreach Report for a campaign execution.

    Returns a styled HTML file (printable as PDF) with all prospect LinkedIn messages.

    **Role Required:** Any authenticated role
    **Headers:** X-User-Role: "admin", "user", or "viewer"
    """
    logger.info(f"Generating LinkedIn report for execution {execution_id}")

    # Fetch classification (campaign metadata)
    classification = db.query(Classification).filter(Classification.id == execution_id).first()
    if not classification:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")

    # Fetch execution details (personalized content)
    execution_detail = db.query(ExecutionDetail)\
        .filter(ExecutionDetail.classification_id == execution_id)\
        .first()

    if not execution_detail:
        raise HTTPException(status_code=404, detail="Execution details not found")

    personalized_content = execution_detail.personalized_content or []
    linkedin_entries = [p for p in personalized_content if p.get("linkedin_message")]

    if not linkedin_entries:
        raise HTTPException(status_code=404, detail="No LinkedIn content found for this execution")

    # ── Build metadata ──────────────────────────────────────────
    generated_at = datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")
    category = classification.category.replace("_", " ").title() if classification.category else "Campaign"
    archetype = execution_detail.target_archetype or "B2B Decision Makers"
    channel = (execution_detail.selected_channel or "linkedin").upper()
    sender = execution_detail.sender_name or "Marketing Team"
    audience = execution_detail.target_audience or "Target Audience"
    prospect_count = len(linkedin_entries)

    # ── Build per-prospect HTML cards ───────────────────────────
    prospect_cards_html = ""
    for i, p in enumerate(linkedin_entries, 1):
        name = p.get("prospect_name", "Unknown")
        company = p.get("prospect_company", "")
        title = p.get("prospect_job_title", "")
        message = p.get("linkedin_message", "").replace("\n", "<br>")
        icp_score = p.get("icp_fit_score", None)

        score_html = ""
        if icp_score is not None:
            score_color = "#10b981" if icp_score >= 75 else ("#f59e0b" if icp_score >= 50 else "#ef4444")
            score_html = f'<span style="display:inline-block;padding:2px 10px;background:{score_color}20;color:{score_color};border:1px solid {score_color}40;border-radius:20px;font-size:11px;font-weight:700;margin-left:10px;">ICP Score: {icp_score}/100</span>'

        prospect_cards_html += f"""
        <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px;overflow:hidden;page-break-inside:avoid;">
          <div style="background:linear-gradient(135deg,#1e3a5f,#0f62a8);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span style="color:#93c5fd;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Prospect {i} of {prospect_count}</span>
              <h3 style="color:#ffffff;margin:2px 0 0;font-size:16px;font-weight:700;">{name}</h3>
              <p style="color:#bfdbfe;margin:2px 0 0;font-size:12px;">{title} &nbsp;·&nbsp; {company}</p>
            </div>
            <div style="text-align:right;">{score_html}</div>
          </div>
          <div style="padding:18px 20px;">
            <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">LinkedIn Message</p>
            <div style="font-size:14px;line-height:1.75;color:#1f2937;background:#f9fafb;border-left:3px solid #0f62a8;padding:12px 16px;border-radius:0 8px 8px 0;">{message}</div>
          </div>
        </div>"""

    # ── Assemble full HTML ──────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LinkedIn Outreach Report – {category}</title>
  <style>
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; color: #111827; }}
    .wrapper {{ max-width: 820px; margin: 0 auto; padding: 32px 20px; }}
    @media print {{
      body {{ background: #fff; }}
      .no-print {{ display: none !important; }}
      .wrapper {{ padding: 0; }}
    }}
  </style>
</head>
<body>
<div class="wrapper">

  <!-- Cover -->
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f62a8 60%,#0ea5e9 100%);border-radius:16px;padding:40px;margin-bottom:28px;color:#fff;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">🔗</div>
      <span style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.8;">LinkedIn Outreach Report</span>
    </div>
    <h1 style="font-size:28px;font-weight:800;letter-spacing:-0.5px;margin-bottom:6px;">{category}</h1>
    <p style="font-size:14px;opacity:0.8;margin-bottom:24px;">Generated for <strong>{audience}</strong> · Sender: <strong>{sender}</strong></p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:14px;">
        <p style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Prospects</p>
        <p style="font-size:24px;font-weight:800;">{prospect_count}</p>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:14px;">
        <p style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Target</p>
        <p style="font-size:13px;font-weight:700;line-height:1.3;">{archetype}</p>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:14px;">
        <p style="font-size:11px;opacity:0.7;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Channel</p>
        <p style="font-size:18px;font-weight:800;">{channel}</p>
      </div>
    </div>
  </div>

  <!-- Print button -->
  <div class="no-print" style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="background:#0f62a8;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">🖨️ Save as PDF</button>
  </div>

  <!-- Prospect cards -->
  {prospect_cards_html}

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
    <p>Generated by the Multi-Agent Marketing System &nbsp;·&nbsp; {generated_at}</p>
    <p style="margin-top:4px;">Campaign ID: {execution_id}</p>
  </div>

</div>
</body>
</html>"""

    filename = f"linkedin_report_{execution_id[:8]}_{datetime.utcnow().strftime('%Y%m%d')}.html"
    return Response(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


class UpdateContentRequest(BaseModel):
    """Schema for updating personalized content"""
    linkedin_message: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    call_script_opener: Optional[str] = None
    call_script_objections: Optional[List[str]] = None
    call_script_close: Optional[str] = None


class RegenerateContentRequest(BaseModel):
    """Schema for AI-assisted content regeneration"""
    custom_prompt: str = Field(
        ...,
        description="Custom instructions for modifying the content",
        min_length=10,
        max_length=1000
    )
    content_type: Optional[str] = Field(
        None,
        description="Specific type to regenerate: 'linkedin', 'email', 'call_script', or 'all'"
    )


@app.patch("/history/executions/{execution_id}/personalized-content/{prospect_id}")
async def update_personalized_content(
    execution_id: str,
    prospect_id: str,
    content_update: UpdateContentRequest,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Update personalized content for a specific prospect manually
    
    **Role Required:** Admin or User (Viewers cannot edit)
    
    Allows manual editing of generated content for a specific prospect.
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    logger.info(f"Updating personalized content for execution {execution_id}, prospect {prospect_id}")
    
    try:
        # Fetch the execution details
        execution_detail = db.query(ExecutionDetail)\
            .filter(ExecutionDetail.classification_id == execution_id)\
            .first()
        
        if not execution_detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution details not found for {execution_id}"
            )
        
        # Get personalized content array
        personalized_content = execution_detail.personalized_content or []
        
        # Find the specific prospect's content
        prospect_found = False
        for idx, content in enumerate(personalized_content):
            if content.get("prospect_id") == prospect_id:
                prospect_found = True
                
                # Update fields if provided
                if content_update.linkedin_message is not None:
                    content["linkedin_message"] = content_update.linkedin_message
                
                if content_update.email_subject is not None or content_update.email_body is not None:
                    if "email_message" not in content:
                        content["email_message"] = {}
                    if content_update.email_subject is not None:
                        content["email_message"]["subject"] = content_update.email_subject
                    if content_update.email_body is not None:
                        content["email_message"]["body"] = content_update.email_body
                
                if (content_update.call_script_opener is not None or 
                    content_update.call_script_objections is not None or 
                    content_update.call_script_close is not None):
                    if "call_script" not in content:
                        content["call_script"] = {}
                    if content_update.call_script_opener is not None:
                        content["call_script"]["opener"] = content_update.call_script_opener
                    if content_update.call_script_objections is not None:
                        content["call_script"]["objections"] = content_update.call_script_objections
                    if content_update.call_script_close is not None:
                        content["call_script"]["close"] = content_update.call_script_close
                
                personalized_content[idx] = content
                break
        
        if not prospect_found:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prospect {prospect_id} not found in personalized content"
            )
        
        # Update the database
        execution_detail.personalized_content = personalized_content
        db.commit()
        db.refresh(execution_detail)
        
        logger.info(f"Successfully updated content for prospect {prospect_id}")
        
        return {
            "success": True,
            "message": "Personalized content updated successfully",
            "execution_id": execution_id,
            "prospect_id": prospect_id,
            "updated_content": personalized_content[
                next(i for i, c in enumerate(personalized_content) if c.get("prospect_id") == prospect_id)
            ],
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating personalized content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update personalized content: {str(e)}"
        )


@app.post("/history/executions/{execution_id}/personalized-content/{prospect_id}/regenerate")
async def regenerate_personalized_content(
    execution_id: str,
    prospect_id: str,
    regenerate_request: RegenerateContentRequest,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Regenerate personalized content using AI with custom instructions
    
    **Role Required:** Admin or User (Viewers cannot regenerate)
    
    Uses Gemini API to modify existing content based on custom prompt.
    The current content is sent as context along with the custom prompt.
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    logger.info(f"Regenerating content for execution {execution_id}, prospect {prospect_id}")
    
    try:
        # Fetch the execution details
        execution_detail = db.query(ExecutionDetail)\
            .filter(ExecutionDetail.classification_id == execution_id)\
            .first()
        
        if not execution_detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution details not found for {execution_id}"
            )
        
        # Get personalized content array
        personalized_content = execution_detail.personalized_content or []
        
        # Find the specific prospect's content
        current_content = None
        prospect_idx = None
        for idx, content in enumerate(personalized_content):
            if content.get("prospect_id") == prospect_id:
                current_content = content
                prospect_idx = idx
                break
        
        if not current_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Prospect {prospect_id} not found in personalized content"
            )
        
        # Import LLM here to use for regeneration
        from utils.llm import get_llm
        from langchain_core.messages import HumanMessage, SystemMessage
        
        llm = get_llm(temperature=0.7)
        
        # Build context from current content
        content_context = f"""
Current Personalized Content for {current_content.get('prospect_name', 'Prospect')}:
- Job Title: {current_content.get('prospect_job_title', 'N/A')}
- Company: {current_content.get('prospect_company', 'N/A')}

LinkedIn Message:
{current_content.get('linkedin_message', 'N/A')}

Email Subject: {current_content.get('email_message', {}).get('subject', 'N/A')}
Email Body:
{current_content.get('email_message', {}).get('body', 'N/A')}

Call Script Opener:
{current_content.get('call_script', {}).get('opener', 'N/A')}

Call Script Close:
{current_content.get('call_script', {}).get('close', 'N/A')}
"""
        
        # Create regeneration prompt
        system_message = SystemMessage(content="""You are an expert marketing content writer. 
Your task is to modify the provided marketing content based on the user's custom instructions.
Maintain the professional tone and personalization for the prospect.
Return ONLY a JSON object with the modified content in this exact structure:
{
  "linkedin_message": "modified linkedin message here",
  "email_message": {
    "subject": "modified email subject",
    "body": "modified email body"
  },
  "call_script": {
    "opener": "modified call opener",
    "objections": ["objection response 1", "objection response 2", "objection response 3"],
    "close": "modified call close"
  }
}

Ensure all fields are filled even if they weren't modified. Keep the JSON valid and properly formatted.""")
        
        human_message = HumanMessage(content=f"""{content_context}

User's Custom Instructions:
{regenerate_request.custom_prompt}

Please regenerate the marketing content based on these instructions. Return only the JSON object.""")
        
        # Call Gemini API
        response = llm.invoke([system_message, human_message])
        response_text = response.content.strip()
        
        # Try to extract JSON from response
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group()
        
        # Parse the response
        try:
            regenerated_content = json.loads(response_text)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to clean it
            response_text = response_text.replace('```json', '').replace('```', '').strip()
            regenerated_content = json.loads(response_text)
        
        # Update the content while preserving prospect info
        updated_content = {
            "prospect_id": current_content["prospect_id"],
            "prospect_name": current_content["prospect_name"],
            "prospect_company": current_content["prospect_company"],
            "prospect_job_title": current_content["prospect_job_title"],
            "linkedin_message": regenerated_content.get("linkedin_message", current_content.get("linkedin_message")),
            "email_message": regenerated_content.get("email_message", current_content.get("email_message")),
            "call_script": regenerated_content.get("call_script", current_content.get("call_script"))
        }
        
        # Update in the array
        personalized_content[prospect_idx] = updated_content
        
        # Save to database
        execution_detail.personalized_content = personalized_content
        db.commit()
        db.refresh(execution_detail)
        
        logger.info(f"Successfully regenerated content for prospect {prospect_id}")
        
        return {
            "success": True,
            "message": "Content regenerated successfully using AI",
            "execution_id": execution_id,
            "prospect_id": prospect_id,
            "updated_content": updated_content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse AI response: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to parse AI response. Please try again."
        )
    except Exception as e:
        db.rollback()
        logger.error(f"Error regenerating content: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate content: {str(e)}"
        )


# ========================================
# FOLLOW-UP SEQUENCE ENDPOINTS
# ========================================

FOLLOW_UP_ANGLES = [
    {"step": 1, "angle": "value_reinforcement", "day_offset": 4,
     "instruction": "Write a concise follow-up email (Day 4) that reinforces the VALUE of the solution. Pick ONE specific benefit or outcome relevant to their pain point and expand on it with a concrete example. Do NOT re-pitch the whole product — be brief and add something new."},
    {"step": 2, "angle": "social_proof", "day_offset": 8,
     "instruction": "Write a follow-up email (Day 8) using SOCIAL PROOF. Mention what a similar company or role (same industry/function) achieved with this solution — a specific outcome or metric. Keep it short and end with a soft CTA."},
    {"step": 3, "angle": "breakup", "day_offset": 10,
     "instruction": "Write a short BREAK-UP EMAIL (Day 10). Respectfully acknowledge you haven't heard back, assume they may be busy, and offer to close the thread. Create gentle urgency without pressure. End with a single low-friction question."},
]


@app.post("/follow-ups/create/{execution_id}")
async def create_follow_up_sequence(
    execution_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Generate and queue a 3-step follow-up email sequence for every prospect in a campaign.

    The LLM generates three different angle emails per prospect:
    - Step 1 (Day +4): Value reinforcement
    - Step 2 (Day +8): Social proof
    - Step 3 (Day +10): Break-up / closing

    **Role Required:** Admin or User
    """
    logger.info(f"Creating 3-step follow-up sequence for execution {execution_id}")

    # Verify execution exists
    classification = db.query(Classification).filter(Classification.id == execution_id).first()
    if not classification:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")

    # Prevent duplicate sequences
    existing = db.query(FollowUpEmail).filter(FollowUpEmail.execution_id == execution_id).count()
    if existing > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Follow-up sequence already exists for this execution ({existing} emails queued). Delete them first to recreate."
        )

    execution_detail = db.query(ExecutionDetail)\
        .filter(ExecutionDetail.classification_id == execution_id).first()
    if not execution_detail:
        raise HTTPException(status_code=404, detail="Execution details not found")

    personalized_content = execution_detail.personalized_content or []
    email_prospects = [p for p in personalized_content if p.get("email_message")]
    if not email_prospects:
        raise HTTPException(status_code=404, detail="No email content found for this execution")

    # Import LLM
    from utils.llm import get_llm
    from langchain_core.messages import HumanMessage, SystemMessage
    llm = get_llm(temperature=0.65)

    base_date = classification.created_at or datetime.utcnow()
    created_rows = []

    for pc in email_prospects:
        prospect_name = pc.get("prospect_name", "Prospect")
        prospect_job = pc.get("prospect_job_title", "")
        prospect_company = pc.get("prospect_company", "")
        original_subject = pc.get("email_message", {}).get("subject", "")
        original_body = pc.get("email_message", {}).get("body", "")
        sender = execution_detail.sender_name or "the team"
        product = execution_detail.product_name or "our solution"

        for angle_def in FOLLOW_UP_ANGLES:
            step = angle_def["step"]
            angle = angle_def["angle"]
            day_offset = angle_def["day_offset"]
            instruction = angle_def["instruction"]

            system_msg = SystemMessage(content=f"""You are {sender}, an expert B2B sales professional.
You are writing a follow-up email to {prospect_name}, {prospect_job} at {prospect_company}.
Product: {product}

Original email sent:
Subject: {original_subject}
Body:
{original_body}

Your task: {instruction}

Return ONLY a valid JSON object with exactly these two fields:
{{
  "subject": "email subject line",
  "body": "email body text (plain text, use line breaks)"
}}
Do NOT include any explanation or markdown. Just the JSON.""")
            human_msg = HumanMessage(content="Generate the follow-up email now.")

            try:
                ai_response = llm.invoke([system_msg, human_msg])
                raw = ai_response.content.strip()
                # Strip markdown fences if present
                if raw.startswith("```"):
                    raw = "\n".join(raw.split("\n")[1:])
                if raw.endswith("```"):
                    raw = "\n".join(raw.split("\n")[:-1])
                result = json.loads(raw)
                subject = result.get("subject", f"Re: {original_subject}")
                body = result.get("body", "")
            except Exception as e:
                logger.warning(f"LLM failed for step {step}, prospect {prospect_name}: {e}")
                subject = f"Re: {original_subject}" if step < 3 else "Following up one last time"
                body = f"Hi {prospect_name.split()[0] if prospect_name else 'there'},\n\nJust wanted to follow up briefly on my previous email about {product}.\n\nWould you have 15 minutes to connect?\n\nBest,\n{sender}"

            from datetime import timedelta
            scheduled_date = base_date + timedelta(days=day_offset)

            row = FollowUpEmail(
                execution_id=execution_id,
                prospect_id=pc.get("prospect_id"),
                prospect_name=prospect_name,
                prospect_email=pc.get("prospect_email", ""),
                prospect_company=prospect_company,
                prospect_job_title=prospect_job,
                step=step,
                angle=angle,
                scheduled_date=scheduled_date,
                subject=subject,
                body=body,
                status="pending",
            )
            db.add(row)
            created_rows.append(row)

    db.commit()
    logger.info(f"Created {len(created_rows)} follow-up emails for execution {execution_id}")

    return {
        "success": True,
        "execution_id": execution_id,
        "queued_count": len(created_rows),
        "prospects_count": len(email_prospects),
        "steps_per_prospect": 3,
        "message": f"Queued {len(created_rows)} follow-up emails across {len(email_prospects)} prospects (3 steps each).",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/follow-ups/execution/{execution_id}")
async def list_follow_ups_for_execution(
    execution_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    List all queued follow-up emails for a campaign execution, grouped by prospect.
    """
    rows = db.query(FollowUpEmail)\
        .filter(FollowUpEmail.execution_id == execution_id)\
        .order_by(FollowUpEmail.prospect_name, FollowUpEmail.step)\
        .all()

    if not rows:
        return {"follow_ups": [], "total": 0, "execution_id": execution_id}

    # Group by prospect
    grouped: dict = {}
    for row in rows:
        pid = str(row.prospect_id)
        if pid not in grouped:
            grouped[pid] = {
                "prospect_id": pid,
                "prospect_name": row.prospect_name,
                "prospect_email": row.prospect_email,
                "prospect_company": row.prospect_company,
                "prospect_job_title": row.prospect_job_title,
                "steps": []
            }
        grouped[pid]["steps"].append({
            "id": str(row.id),
            "step": row.step,
            "angle": row.angle,
            "scheduled_date": row.scheduled_date.isoformat() if row.scheduled_date else None,
            "status": row.status,
            "subject": row.subject,
            "body_preview": (row.body or "")[:150] + ("..." if len(row.body or "") > 150 else ""),
            "body": row.body,
            "sent_at": row.sent_at.isoformat() if row.sent_at else None,
            "recipient_email": row.recipient_email,
        })

    return {
        "follow_ups": list(grouped.values()),
        "total": len(rows),
        "execution_id": execution_id
    }


@app.post("/follow-ups/send/{follow_up_id}")
async def send_follow_up_email(
    follow_up_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Send a specific follow-up email via Maileroo SMTP.
    Updates status to 'sent' and records sent_at timestamp.
    """
    from config import HARDCODED_TEST_EMAILS, MAILEROO_FROM_EMAIL, MAILEROO_FROM_NAME

    row = db.query(FollowUpEmail).filter(FollowUpEmail.id == follow_up_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Follow-up email not found")
    if row.status == "sent":
        raise HTTPException(status_code=409, detail="This follow-up has already been sent")
    if row.status == "skipped":
        raise HTTPException(status_code=409, detail="This follow-up was skipped — cannot send")

    # Select recipient (round-robin from hardcoded test emails based on prospect hash)
    recipient_idx = hash(str(row.prospect_id)) % len(HARDCODED_TEST_EMAILS)
    recipient = HARDCODED_TEST_EMAILS[recipient_idx]

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = row.subject
        msg["From"] = f"{MAILEROO_FROM_NAME} <{MAILEROO_FROM_EMAIL}>"
        msg["To"] = recipient
        msg["Reply-To"] = MAILEROO_FROM_EMAIL

        # Plain text
        msg.attach(MIMEText(row.body or "", "plain"))

        # Send via SMTP
        with smtplib.SMTP(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT) as smtp:
            if MAILEROO_USE_TLS:
                smtp.starttls()
            if MAILEROO_SMTP_USERNAME and MAILEROO_SMTP_PASSWORD:
                smtp.login(MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD)
            smtp.sendmail(MAILEROO_FROM_EMAIL, [recipient], msg.as_string())

        # Update DB
        row.status = "sent"
        row.sent_at = datetime.utcnow()
        row.recipient_email = recipient
        db.commit()

        logger.info(f"Follow-up step {row.step} sent for prospect {row.prospect_name} → {recipient}")

        return {
            "success": True,
            "follow_up_id": follow_up_id,
            "step": row.step,
            "angle": row.angle,
            "prospect_name": row.prospect_name,
            "recipient_email": recipient,
            "sent_at": row.sent_at.isoformat(),
            "message": f"Step {row.step} follow-up sent to {recipient}"
        }

    except smtplib.SMTPException as e:
        db.rollback()
        logger.error(f"SMTP error sending follow-up {follow_up_id}: {e}")
        raise HTTPException(status_code=502, detail=f"SMTP error: {str(e)}")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error sending follow-up {follow_up_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Send failed: {str(e)}")


@app.post("/follow-ups/skip/{follow_up_id}")
async def skip_follow_up(
    follow_up_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Mark a follow-up email as skipped (user decided not to send it).
    """
    row = db.query(FollowUpEmail).filter(FollowUpEmail.id == follow_up_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Follow-up email not found")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail=f"Cannot skip — status is already '{row.status}'")

    row.status = "skipped"
    db.commit()

    return {
        "success": True,
        "follow_up_id": follow_up_id,
        "step": row.step,
        "prospect_name": row.prospect_name,
        "message": f"Step {row.step} follow-up skipped."
    }



@app.get("/prospects/recent")
async def get_recent_campaign_prospects(
    limit: int = 50,
    page: int = 1,
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Get paginated list of all prospects from the database with total count
    
    **Role Required:** Admin, User, or Viewer (read-only)
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Get detailed information for a specific prospect
    
    **Role Required:** Admin, User, or Viewer (read-only)
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
    role: str = Depends(require_role([Role.ADMIN, Role.USER, Role.VIEWER])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve prospects with priority scores
    
    **Role Required:** Admin, User, or Viewer (read-only)
    
    Returns prospects sorted by priority score, showing engagement history.
    
    **Headers:**
    - X-User-Role: "user", "admin", or "viewer"
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
    Viewers and Users cannot access this endpoint.
    
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


@app.get("/admin/api-calls")
async def get_api_call_logs(
    limit: int = 100,
    offset: int = 0,
    prompts_only: bool = False,
    role: str = Depends(require_role([Role.ADMIN])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve API call logs for monitoring and analytics (Admin only)
    
    **Role Required:** Admin ONLY
    
    Returns API call metrics including endpoint usage, response times, and error rates.
    
    **Headers:**
    - X-User-Role: "admin"
    
    **Query Parameters:**
    - prompts_only: If true, only returns logs that contain prompts
    """
    logger.info(f"Admin accessing API call logs (limit: {limit}, offset: {offset}, prompts_only: {prompts_only})")
    
    try:
        # Build base query
        base_query = db.query(APICallLog)
        
        # Filter for prompts only if requested
        if prompts_only:
            base_query = base_query.filter(APICallLog.prompt_preview.isnot(None))
        
        # Get total count
        total_count = base_query.count()
        
        # Get logs
        logs = base_query\
            .order_by(desc(APICallLog.created_at))\
            .limit(limit)\
            .offset(offset)\
            .all()
        
        # Get aggregated statistics
        stats = db.query(
            func.count(APICallLog.id).label('total_calls'),
            func.avg(APICallLog.response_time_ms).label('avg_response_time'),
            func.count(APICallLog.id).filter(APICallLog.status_code >= 400).label('error_count')
        ).first()
        
        return {
            "logs": [
                {
                    "id": str(log.id),
                    "endpoint": log.endpoint,
                    "method": log.method,
                    "user_role": log.user_role,
                    "status_code": log.status_code,
                    "response_time_ms": log.response_time_ms,
                    "ip_address": log.ip_address,
                    "prompt_preview": log.prompt_preview,
                    "created_at": log.created_at.isoformat() + 'Z' if log.created_at else None
                }
                for log in logs
            ],
            "total": total_count,
            "limit": limit,
            "offset": offset,
            "statistics": {
                "total_calls": stats.total_calls or 0,
                "avg_response_time_ms": round(stats.avg_response_time, 2) if stats.avg_response_time else 0,
                "error_count": stats.error_count or 0,
                "success_rate": round((1 - (stats.error_count or 0) / max(stats.total_calls or 1, 1)) * 100, 2)
            }
        }
    except Exception as e:
        logger.error(f"Error fetching API call logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve API call logs: {str(e)}"
        )


@app.get("/admin/api-calls/export")
async def export_api_call_logs(
    format: Literal["csv", "json"] = "csv",
    prompts_only: bool = False,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_role: Optional[str] = None,
    endpoint: Optional[str] = None,
    min_status: Optional[int] = None,
    max_status: Optional[int] = None,
    role: str = Depends(require_role([Role.ADMIN])),
    db: Session = Depends(get_db_session)
):
    """
    Export API call logs with filters (Admin only)
    
    **Role Required:** Admin ONLY
    
    **Query Parameters:**
    - format: "csv" or "json" (default: csv)
    - prompts_only: Filter to only logs with prompts
    - start_date: ISO format start date (e.g., 2026-02-01)
    - end_date: ISO format end date (e.g., 2026-02-28)
    - user_role: Filter by role (admin/user/viewer)
    - endpoint: Filter by endpoint path
    - min_status: Minimum status code
    - max_status: Maximum status code
    """
    logger.info(f"Admin exporting API logs (format: {format}, prompts_only: {prompts_only})")
    
    try:
        # Build query with filters
        query = db.query(APICallLog)
        
        if prompts_only:
            query = query.filter(APICallLog.prompt_preview.isnot(None))
        
        if start_date:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(APICallLog.created_at >= start_dt)
        
        if end_date:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(APICallLog.created_at <= end_dt)
        
        if user_role:
            query = query.filter(APICallLog.user_role == user_role)
        
        if endpoint:
            query = query.filter(APICallLog.endpoint.contains(endpoint))
        
        if min_status is not None:
            query = query.filter(APICallLog.status_code >= min_status)
        
        if max_status is not None:
            query = query.filter(APICallLog.status_code <= max_status)
        
        # Get all matching logs
        logs = query.order_by(desc(APICallLog.created_at)).all()
        
        if format == "csv":
            # Create CSV
            output = io.StringIO()
            fieldnames = [
                'id', 'endpoint', 'method', 'user_role', 'status_code',
                'response_time_ms', 'ip_address', 'prompt_preview', 'created_at'
            ]
            writer = csv.DictWriter(output, fieldnames=fieldnames)
            writer.writeheader()
            
            for log in logs:
                writer.writerow({
                    'id': str(log.id),
                    'endpoint': log.endpoint,
                    'method': log.method,
                    'user_role': log.user_role,
                    'status_code': log.status_code,
                    'response_time_ms': log.response_time_ms,
                    'ip_address': log.ip_address or '',
                    'prompt_preview': log.prompt_preview or '',
                    'created_at': log.created_at.isoformat() if log.created_at else ''
                })
            
            csv_content = output.getvalue()
            output.close()
            
            filename = f"api_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        
        else:  # JSON format
            logs_data = [
                {
                    "id": str(log.id),
                    "endpoint": log.endpoint,
                    "method": log.method,
                    "user_role": log.user_role,
                    "status_code": log.status_code,
                    "response_time_ms": log.response_time_ms,
                    "ip_address": log.ip_address,
                    "prompt_preview": log.prompt_preview,
                    "created_at": log.created_at.isoformat() + 'Z' if log.created_at else None
                }
                for log in logs
            ]
            
            filename = f"api_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            return Response(
                content=json.dumps({
                    "exported_at": datetime.now().isoformat(),
                    "total_records": len(logs_data),
                    "filters": {
                        "prompts_only": prompts_only,
                        "start_date": start_date,
                        "end_date": end_date,
                        "user_role": user_role,
                        "endpoint": endpoint,
                        "min_status": min_status,
                        "max_status": max_status
                    },
                    "logs": logs_data
                }, indent=2),
                media_type="application/json",
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    
    except Exception as e:
        logger.error(f"Error exporting API logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export API logs: {str(e)}"
        )


@app.get("/admin/audit-logs")
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    role: str = Depends(require_role([Role.ADMIN])),
    db: Session = Depends(get_db_session)
):
    """
    Retrieve security audit logs for compliance (Admin only)
    
    **Role Required:** Admin ONLY
    
    Returns audit trail of all actions performed in the system, including AI prompts used.
    
    **Headers:**
    - X-User-Role: "admin"
    """
    logger.info(f"Admin accessing audit logs (limit: {limit}, offset: {offset})")
    
    try:
        # Build query with optional filters
        query = db.query(AuditLog)
        
        if action:
            query = query.filter(AuditLog.action == action)
        if resource_type:
            query = query.filter(AuditLog.resource_type == resource_type)
        
        # Get total count
        total_count = query.count()
        
        # Get logs
        logs = query\
            .order_by(desc(AuditLog.created_at))\
            .limit(limit)\
            .offset(offset)\
            .all()
        
        return {
            "logs": [
                {
                    "id": str(log.id),
                    "action": log.action,
                    "resource_type": log.resource_type,
                    "resource_id": str(log.resource_id) if log.resource_id else None,
                    "user_role": log.user_role,
                    "ip_address": log.ip_address,
                    "details": log.details,
                    "llm_model": log.llm_model,
                    "created_at": log.created_at.isoformat() if log.created_at else None
                }
                for log in logs
            ],
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Error fetching audit logs: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve audit logs: {str(e)}"
        )


@app.post("/history/executions/{execution_id}/personalized-content/{prospect_id}/send-email")
async def send_email_via_maileroo(
    execution_id: str,
    prospect_id: str,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Send personalized email via Maileroo SMTP
    
    **Role Required:** Admin or User (Viewers cannot send emails)
    
    Sends the personalized email content to a hardcoded test email (joshmessi68@gmail.com)
    using Maileroo's SMTP server.
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    logger.info(f"Sending email for execution {execution_id}, prospect {prospect_id}")
    
    try:
        # Fetch the execution details
        execution_detail = db.query(ExecutionDetail)\
            .filter(ExecutionDetail.classification_id == execution_id)\
            .first()
        
        if not execution_detail:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution details not found for {execution_id}"
            )
        
        # Get personalized content array
        personalized_content = execution_detail.personalized_content or []
        
        # Find the specific prospect's content
        email_content = None
        prospect_data = None
        for content in personalized_content:
            if content.get("prospect_id") == prospect_id:
                email_content = content.get("email_message")
                prospect_data = content
                break
        
        if not email_content:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Email content not found for prospect {prospect_id}"
            )
        
        prospect_name = prospect_data.get("prospect_name", "Prospect")
        email_subject = email_content.get("subject", "No Subject")
        email_body = email_content.get("body", "")
        
        # Check if Maileroo SMTP is configured
        if not MAILEROO_SMTP_USERNAME or not MAILEROO_SMTP_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Maileroo SMTP not configured. Please set MAILEROO_SMTP_USERNAME and MAILEROO_SMTP_PASSWORD in environment variables."
            )
        
        # Hardcoded recipient email
        recipient_email = "joshmessi68@gmail.com"
        
        # Create email message
        message = MIMEMultipart("alternative")
        message["Subject"] = email_subject
        message["From"] = f"{MAILEROO_FROM_NAME} <{MAILEROO_FROM_EMAIL}>"
        message["To"] = recipient_email
        
        # Create plain text and HTML versions
        text_part = MIMEText(email_body, "plain")
        html_part = MIMEText(email_body.replace("\n", "<br>"), "html")
        
        message.attach(text_part)
        message.attach(html_part)
        
        # Send email via SMTP
        try:
            if MAILEROO_SMTP_PORT == 465:
                # Use SSL
                with smtplib.SMTP_SSL(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT, timeout=10) as server:
                    server.login(MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD)
                    server.send_message(message)
            else:
                # Use STARTTLS for ports 587 and 2525
                with smtplib.SMTP(MAILEROO_SMTP_HOST, MAILEROO_SMTP_PORT, timeout=10) as server:
                    server.ehlo()
                    if MAILEROO_USE_TLS:
                        server.starttls()
                        server.ehlo()
                    server.login(MAILEROO_SMTP_USERNAME, MAILEROO_SMTP_PASSWORD)
                    server.send_message(message)
            
            logger.info(f"Email sent successfully to {recipient_email} via SMTP")
            
            # Log sent email to database
            try:
                sent_email = SentEmail(
                    execution_id=execution_id,
                    prospect_id=prospect_id,
                    prospect_name=prospect_name,
                    prospect_email=prospect_data.get("prospect_email", "unknown"),
                    prospect_company=prospect_data.get("prospect_company", ""),
                    prospect_job_title=prospect_data.get("prospect_job_title", ""),
                    email_subject=email_subject,
                    email_body=email_body,
                    recipient_email=recipient_email,
                    sent_by_role=role,
                    status='sent'
                )
                db.add(sent_email)
                db.commit()
                logger.info(f"Logged sent email to database: {sent_email.id}")
            except Exception as log_error:
                logger.error(f"Failed to log sent email: {log_error}")
                # Don't fail the request if logging fails
            
            return {
                "success": True,
                "message": f"Email sent successfully to {recipient_email}",
                "execution_id": execution_id,
                "prospect_id": prospect_id,
                "prospect_name": prospect_name,
                "recipient": recipient_email,
                "subject": email_subject,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"SMTP authentication failed. Please check your Maileroo credentials."
            )
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to send email via SMTP: {str(e)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending email: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email: {str(e)}"
        )


@app.get("/history/sent-emails")
async def get_sent_emails(
    execution_id: Optional[str] = None,
    prospect_id: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    role: str = Depends(require_role([Role.ADMIN, Role.USER])),
    db: Session = Depends(get_db_session)
):
    """
    Get sent email history
    
    **Role Required:** Admin or User (Viewers cannot access)
    
    Admins can see all sent emails. Users can see all sent emails too
    (since this is for tracking marketing campaigns).
    
    **Query Parameters:**
    - execution_id: Filter by execution/campaign ID
    - prospect_id: Filter by prospect ID
    - limit: Maximum number of results (default: 100)
    - offset: Pagination offset (default: 0)
    
    **Headers:**
    - X-User-Role: "user" or "admin"
    """
    try:
        query = db.query(SentEmail)
        
        # Apply filters
        if execution_id:
            query = query.filter(SentEmail.execution_id == execution_id)
        if prospect_id:
            query = query.filter(SentEmail.prospect_id == prospect_id)
        
        # Get total count before pagination
        total_count = query.count()
        
        # Order by sent_at descending (most recent first)
        query = query.order_by(SentEmail.sent_at.desc())
        
        # Apply pagination
        sent_emails = query.limit(limit).offset(offset).all()
        
        # Format response
        results = []
        for email in sent_emails:
            results.append({
                "id": str(email.id),
                "execution_id": email.execution_id,
                "prospect_id": email.prospect_id,
                "prospect_name": email.prospect_name,
                "prospect_email": email.prospect_email,
                "prospect_company": email.prospect_company,
                "prospect_job_title": email.prospect_job_title,
                "email_subject": email.email_subject,
                "email_body": email.email_body,
                "recipient_email": email.recipient_email,
                "sent_by_role": email.sent_by_role,
                "sent_at": email.sent_at.isoformat() if email.sent_at else None,
                "status": email.status
            })
        
        return {
            "sent_emails": results,
            "total_count": total_count,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"Error fetching sent emails: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve sent emails: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint (no authentication required)"""
    return {
        "status": "healthy",
        "service": "multi-agent-marketing-api",
        "timestamp": datetime.utcnow().isoformat()
    }


# ========================================
# TWILIO CALL WEBHOOK ENDPOINTS
# ========================================

@app.post("/api/twilio/voice")
async def twilio_voice_webhook(request: Request):
    """
    Initial webhook when Twilio call connects.
    Speaks the opener and starts listening for the prospect's response.
    """
    from utils.call_conversation import get_call_context, get_opener_text
    
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    
    logger.info(f"Twilio voice webhook called for SID: {call_sid}")
    
    context = get_call_context(call_sid)
    
    if not context:
        # No context registered - just say a generic message
        twiml = '<Response><Say voice="alice">Sorry, there was an error setting up this call. Goodbye.</Say></Response>'
        return Response(content=twiml, media_type="application/xml")
    
    # Get the opener text
    opener = get_opener_text(call_sid)
    
    # Build TwiML: Say the opener, then Gather (listen for response)
    webhook_base = _get_webhook_base_url()
    gather_url = f"{webhook_base}/api/twilio/respond"
    
    twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">{_escape_twiml(opener)}</Say>
    <Gather input="speech" action="{gather_url}" method="POST" 
            speechTimeout="3" timeout="10" language="en-US">
        <Say voice="alice">.</Say>
    </Gather>
    <Say voice="alice">I didn't catch that. Thank you for your time. Goodbye!</Say>
</Response>'''
    
    logger.info(f"Call {call_sid} - Speaking opener and waiting for response")
    return Response(content=twiml, media_type="application/xml")


@app.post("/api/twilio/respond")
async def twilio_respond_webhook(request: Request):
    """
    Webhook called when Twilio captures the prospect's speech.
    Sends transcription to Gemini, gets AI response, speaks it back.
    """
    from utils.call_conversation import generate_ai_response, should_continue, cleanup_call, get_call_context
    
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    speech_result = form_data.get("SpeechResult", "")
    
    logger.info(f"Twilio respond webhook - SID: {call_sid}")
    logger.info(f"  Prospect said: {speech_result}")
    
    if not speech_result:
        # No speech detected - ask again or wrap up
        context = get_call_context(call_sid)
        if not context:
            twiml = '<Response><Say voice="alice">Thank you for your time. Goodbye!</Say><Hangup/></Response>'
            return Response(content=twiml, media_type="application/xml")
        
        webhook_base = _get_webhook_base_url()
        gather_url = f"{webhook_base}/api/twilio/respond"
        
        twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Are you still there?</Say>
    <Gather input="speech" action="{gather_url}" method="POST"
            speechTimeout="3" timeout="8" language="en-US">
        <Say voice="alice">.</Say>
    </Gather>
    <Say voice="alice">It seems like you might be busy. I'll follow up over email. Thank you!</Say>
    <Hangup/>
</Response>'''
        return Response(content=twiml, media_type="application/xml")
    
    # Generate AI response using Gemini
    ai_response = generate_ai_response(call_sid, speech_result)
    
    # Check if we should continue the conversation
    if should_continue(call_sid):
        # Continue conversation: speak response + listen again
        webhook_base = _get_webhook_base_url()
        gather_url = f"{webhook_base}/api/twilio/respond"
        
        twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">{_escape_twiml(ai_response)}</Say>
    <Gather input="speech" action="{gather_url}" method="POST"
            speechTimeout="3" timeout="10" language="en-US">
        <Say voice="alice">.</Say>
    </Gather>
    <Say voice="alice">Thank you so much for your time today. Have a great day!</Say>
</Response>'''
    else:
        # Final turn - speak response and hang up
        twiml = f'''<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-US">{_escape_twiml(ai_response)}</Say>
    <Say voice="alice">Thank you for your time. Have a wonderful day!</Say>
    <Hangup/>
</Response>'''
        # Clean up the call context
        cleanup_call(call_sid)
    
    return Response(content=twiml, media_type="application/xml")


@app.post("/api/twilio/status")
async def twilio_status_webhook(request: Request):
    """
    Webhook for call status updates (completed, failed, etc.)
    Cleans up call context when call ends.
    """
    from utils.call_conversation import cleanup_call
    
    form_data = await request.form()
    call_sid = form_data.get("CallSid", "")
    call_status = form_data.get("CallStatus", "")
    
    logger.info(f"Call status update - SID: {call_sid}, Status: {call_status}")
    
    if call_status in ["completed", "failed", "busy", "no-answer", "canceled"]:
        cleanup_call(call_sid)
    
    return {"status": "ok"}


def _escape_twiml(text: str) -> str:
    """Escape special XML characters for TwiML"""
    return (
        text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def _get_webhook_base_url() -> str:
    """Get the webhook base URL for Twilio callbacks"""
    from config import TWILIO_WEBHOOK_BASE_URL
    if TWILIO_WEBHOOK_BASE_URL:
        return TWILIO_WEBHOOK_BASE_URL.rstrip("/")
    # Fallback - won't work for Twilio but useful for local testing
    return "http://localhost:8000"


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
