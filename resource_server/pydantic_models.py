from pydantic import BaseModel

class ResourcesRequest(BaseModel):
    search_queries: list[str]
    full_text_requests: list[str]

class SearchResult(BaseModel):
    page: str
    text: str

class SearchRound(BaseModel):
    query: str
    results: list[SearchResult]

class FullTextRequest(BaseModel):
    url: str
    text: str

class ResourcesResponse(BaseModel):
    search_results: list[SearchRound]
    full_text_requests: list[FullTextRequest]

