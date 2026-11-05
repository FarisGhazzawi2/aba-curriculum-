from functools import lru_cache

from strands import Agent
from strands.agent.conversation_manager.null_conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from model.load import load_model
from parse import parse_payload
from memory.session import get_memory_session_manager
from tools import email_tools, employee_tools, leave_tools

DEFAULT_SYSTEM_PROMPT = """
You are an HR assistant for a small company. You help HR staff manage
employee records and leave requests, and draft emails to the HR team.

Use your tools for every fact about employees and leave. Never invent
employee ids, names, dates or records. If a tool returns nothing, say so.

When the user names an employee rather than giving an id, look up the id
with your tools first. If more than one employee matches, ask which one.

Dates are always formatted YYYY-MM-DD. Convert anything the user says
("next Monday", "a week off") into explicit dates and state them back.

Before deleting an employee, name the exact record (name, id, department)
and ask the user to confirm. Only call delete_employee after they confirm.

Drafting and sending are separate steps. Show a drafted email before
sending it, unless the user has explicitly asked you to send it.

Keep answers short and factual.
"""

# Define a collection of tools used by the model
tools = [
    # Employee tools
    employee_tools.create_employee,
    employee_tools.save_employee,
    employee_tools.get_employee,
    employee_tools.list_employees,
    employee_tools.list_employees_by_hire_date,
    employee_tools.delete_employee,
    # Leave tools
    leave_tools.save_leave,
    leave_tools.list_leave,
    # Email tools
    email_tools.generate_leave_email,
    email_tools.send_email_to_hr,
]

def _make_conversation_manager():
    return NullConversationManager()

@lru_cache(maxsize=128)
def _get_agent(session_id: str, actor_id: str) -> Agent:
    """Given a session_id and actor_id, return or construct the corresponding Strands agent.
    Note: caching helps avoid repeated identity fetches on non-bedrock model loads
    and supports in-memory session management for local dev."""
    return Agent(
        model=load_model(),
        session_manager=get_memory_session_manager(session_id, actor_id),
        conversation_manager=_make_conversation_manager(),
        system_prompt=DEFAULT_SYSTEM_PROMPT,
        tools=tools,
    )

def create_app():
    app = BedrockAgentCoreApp()
    log = app.logger

    @app.entrypoint
    async def invoke(payload, context):
        log.info("Invoking Agent.....")

        session_id = getattr(context, "session_id", None) or "default-session"
        prompt, actor_id = parse_payload(payload)

        log.info(f"Invoking with session_id={session_id} and actor_id={actor_id}")
        agent = _get_agent(session_id, actor_id)

        async for event in agent.stream_async(prompt):
            if not isinstance(event, dict) or "event" not in event:
                continue
            cbs = event["event"].get("contentBlockStart")
            if cbs is not None and not cbs.get("start"):
                continue
            yield event

    return app

app = create_app()
if __name__ == "__main__":
    app.run()
