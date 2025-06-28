from transformers import AutoModelForMaskedLM, AutoTokenizer
import torch

class Splade:
    def __init__(self):
        self.model = AutoModelForMaskedLM.from_pretrained(
            "naver/splade-cocondenser-selfdistil"
        )
        self.tokenizer = AutoTokenizer.from_pretrained(
            "naver/splade-cocondenser-selfdistil"
        )

    def augment(self, text: str) -> str:
        tokens = self.tokenizer(
            text, return_tensors="pt", truncation=True, max_length=512
        )
        output = self.model(**tokens)["logits"]
        scores, _ = torch.max(
            torch.log(1 + torch.relu(output)) * tokens["attention_mask"].unsqueeze(-1),
            dim=1,
        )
        
        tokens = scores.squeeze().nonzero().squeeze()
        tokens = " ".join(
            t
            for t in map(self.tokenizer._convert_id_to_token, tokens)
            if not t.startswith("##")
        )
        return text + " " + tokens