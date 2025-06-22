from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import os

# Set your Google API key
os.environ["GOOGLE_API_KEY"] = "AIzaSyB_hx0mxyg3Yos8fyi8g5iV9MsQcZFZeJI"

# Create LangChain Gemini model
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0.2)

# Test prompt
response = llm.invoke([HumanMessage(content="What's the capital of Bangladesh?")])

# Show result
print(response.content)
