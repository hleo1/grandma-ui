from dotenv import load_dotenv

load_dotenv()


import db_utils as db

client = db.connect_to_db()
docs = client.collections.get("docs")
try:
    user_query = input("What would you like to know? -- ")
    response = docs.generate.near_text(
        query=user_query,
        limit=3,
        grouped_task="answer the user's question"
    )
    print(response.generated)
except Exception as e:
    print(e)
finally:
    db.close_db_connection(client)

