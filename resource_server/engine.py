from splade import Splade

splade = Splade()

import json
from thirdai import licensing
from thirdai import neural_db_v2 as ndb
from pydantic_models import SearchRound, SearchResult, FullTextRequest

class SearchEngine:
    def __init__(self, db_path: str, license_key: str):
        print(f"Activating license {license_key}")
        licensing.activate(license_key)
        self.db = ndb.NeuralDB.load(db_path)

    def search(self, queries: list[str], top_k: int = 10) -> list[SearchRound]:
        queries = [splade.augment(query) for query in queries]
        results = self.db.search_batch(queries=queries, top_k=top_k)
        return [
            SearchRound(
                query=query,
                results=[
                    SearchResult(
                    page=result[0].document,
                    text=result[0].metadata["original"] if result[0].metadata and "original" in result[0].metadata else result[0].text
                )
                    for result in query_results
                ]
            )
            for query, query_results in zip(queries, results)
        ]

class TextRetriever:
    def __init__(self, map_location: str):
        with open(map_location, "r") as f:
            self.map = json.load(f)

    def retrieve(self, urls: list[str]) -> list[FullTextRequest]:
        return [
            FullTextRequest(
                url=url,
                text=self.map[url]
            )
            for url in urls
        ]