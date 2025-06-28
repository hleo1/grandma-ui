import json
import weaviate
import json
import os

from weaviate.classes.config import Configure, Property, DataType
from weaviate.classes.init import Auth
from dotenv import load_dotenv


load_dotenv()


def connect_to_db() -> weaviate.WeaviateClient:
    weaviate_url = os.environ["WEAVIATE_URL"]
    weaviate_api_key = os.environ["WEAVIATE_API_KEY"]
    gemini_api_key = os.environ["GEMINI_API_KEY"]

    if not weaviate_url:
        raise ValueError("Weaviate URL not set!")

    client = weaviate.connect_to_weaviate_cloud(
        cluster_url=weaviate_url,
        auth_credentials=Auth.api_key(weaviate_api_key),
        headers={
            "X-Goog-Studio-Api-Key": gemini_api_key
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
      vectorizer_config=Configure.Vectorizer.text2vec_google_aistudio(),
      vector_index_config=Configure.VectorIndex.hnsw(),
      generative_config=Configure.Generative.google(project_id="key-vault-mqco8", model_id="gemini-pro"),
  )
  print(f"Collection '{collection_name}' created")


def batch_import_from_json(client: weaviate.WeaviateClient, collection_name: str, file: str) -> None:
  collection = client.collections.get(collection_name)

  with open(file, 'r') as f:
    data_to_import = json.load(f)

  print(f'Starting batch import of {len(data_to_import)} items from {file}...')
  with collection.batch.dynamic() as batch:
    for url, content in data_to_import.items():
      properties = {
          "url": url,
          "text": content,
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
  batch_import_from_json(client, collection_name, "url_to_text.json")
  close_db_connection(client)
