import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--license-key", type=str, required=True)
parser.add_argument("--db-path", type=str, default="resources/splade-model")
parser.add_argument("--url-to-text-path", type=str, default="resources/url_to_text.json")
args = parser.parse_args()

from fastapi import FastAPI
import uvicorn
from engine import SearchEngine, TextRetriever
from pydantic_models import ResourcesRequest, ResourcesResponse


app = FastAPI()

search_engine = SearchEngine(args.db_path, args.license_key)
text_retriever = TextRetriever(args.url_to_text_path)

@app.post("/resources", response_model=ResourcesResponse)
async def get_resources(request: ResourcesRequest) -> ResourcesResponse:
    search_results = search_engine.search(request.search_queries)
    full_text_requests = text_retriever.retrieve(request.full_text_requests)

    return ResourcesResponse(
        search_results=search_results,
        full_text_requests=full_text_requests
    )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
