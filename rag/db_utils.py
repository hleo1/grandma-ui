import json
import weaviate
import json
import os

from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.init import Auth
from dotenv import load_dotenv


load_dotenv()


def connect_to_db() -> weaviate.WeaviateClient:
    weaviate_url = os.environ.get("WEAVIATE_URL")
    weaviate_api_key = os.environ.get("WEAVIATE_API_KEY")
    openai_api_key = os.environ.get("OPENAI_APIKEY")

    if not weaviate_url or not weaviate_api_key:
        raise ValueError("WEAVIATE_URL, WEAVIATE_API_KEY, and GOOGLE_APIKEY must be set in your environment.")

    client = weaviate.connect_to_weaviate_cloud(
        cluster_url=weaviate_url,
        auth_credentials=Auth.api_key(weaviate_api_key),
        headers={
            "X-OpenAI-Api-Key": openai_api_key
        }
  )

    print("Database connection successful.")
    return client


def close_db_connection(client: weaviate.WeaviateClient) -> None:
  if client and client.is_connected():
    client.close()
    print("Database connection closed successfully.")
  else:
    print("No active datbase connection.")


def create_collection(client: weaviate.WeaviateClient, collection_name: str) -> None:
  if client.collections.exists(collection_name):
    print(f"Collection name '{collection_name}' already exists. No new collections created.")
    return

  print(f"Creating collection '{collection_name}'...")
  client.collections.create(
    name=collection_name,
      properties=[
        Property(name="url", data_type=DataType.TEXT),
        Property(name="content", data_type=DataType.TEXT),
      ],
      vectorizer_config=Configure.Vectorizer.text2vec_openai(),
      vector_index_config=Configure.VectorIndex.hnsw(),
      generative_config=Configure.Generative.openai(model="gpt-4o"),
  )
  print(f"Collection '{collection_name}' created")


def chunk_text(text: str, chunk_size: int = 1000) -> list[str]:
    """Splits text into chunks of a specified size based on word count."""
    words = text.split()
    return [" ".join(words[i : i + chunk_size]) for i in range(0, len(words), chunk_size)]


def batch_import_from_json(client: weaviate.WeaviateClient, collection_name: str, file: str) -> None:
  collection = client.collections.get(collection_name)

  with open(file, 'r') as f:
    data_to_import = json.load(f)

  print(f'Starting batch import of {len(data_to_import)} items from {file}...')
  with collection.batch.dynamic() as batch:
    for url, content in data_to_import.items():
        content_chunks = chunk_text(content)
        for chunk in content_chunks:
            properties = {
                "url": url,
                "content": chunk,
            }

            batch.add_object(properties=properties)
    print("Batch import completed")

    if collection.batch.failed_objects:
      print(f'Failed to import {len(collection.batch.failed_objects)} objects.')
      for failed in collection.batch.failed_objects:
        print(f'* Failed object UUID: {failed.original_uuid}, Error: {failed.message}')




if __name__ == "__main__":
    client = connect_to_db()
    collection_name = "docs"
    client.collections.delete_all()
    create_collection(client, collection_name)
    batch_import_from_json(client, collection_name, "url_to_text.json")
    close_db_connection(client)
