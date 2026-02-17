from fastapi import FastAPI
from pydantic import BaseModel
from graph import app_graph

app = FastAPI()


class RequestModel(BaseModel):
    message: str


@app.post("/generate")
def generate_response(request: RequestModel):
    if not request.message.strip():
        return {"error": "Message cannot be empty"}

    result = app_graph.invoke({
        "user_input": request.message,
        "task_type": "",
        "final_response": ""
    })

    return {
        "task_type": result["task_type"],
        "response": result["final_response"]
    }
