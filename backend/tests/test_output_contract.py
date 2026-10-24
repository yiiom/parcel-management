"""比對手寫回應類別與已確認契約，防止欄位遺漏、型別漂移或洩漏。"""

import json
import unittest
from datetime import datetime
from pathlib import Path

from app.schemas import outputs

CONTRACT = json.loads(
    Path(outputs.__file__).with_name("contract.json").read_text(encoding="utf-8")
)


def structure(schema, definitions):
    """統一 OpenAPI 3.0 nullable 與 Pydantic JSON Schema anyOf 的表示法。"""
    if "$ref" in schema:
        return structure(definitions[schema["$ref"].split("/")[-1]], definitions)
    if "allOf" in schema:
        fields, required = {}, []
        for part in schema["allOf"]:
            if "$ref" in part:
                part = definitions[part["$ref"].split("/")[-1]]
            fields.update(part.get("properties", {}))
            required.extend(part.get("required", []))
        schema = dict(type="object", properties=fields, required=required)
    if "anyOf" in schema:
        non_null = [part for part in schema["anyOf"] if part.get("type") != "null"]
        if len(non_null) != 1:
            raise AssertionError("未涵蓋的新複合型別，請更新契約測試。")
        result = structure(non_null[0], definitions)
        result["nullable"] = True
        return result
    result = {
        key: schema[key]
        for key in (
            "type",
            "enum",
            "minimum",
            "maximum",
            "minLength",
            "maxLength",
            "pattern",
        )
        if key in schema
    }
    if "const" in schema:
        result["enum"] = [schema["const"]]
    if schema.get("format") == "date-time":
        result["format"] = "date-time"
    if schema.get("nullable"):
        result["nullable"] = True
    if "properties" in schema:
        result["properties"] = {
            key: structure(value, definitions)
            for key, value in schema["properties"].items()
        }
        result["required"] = sorted(schema.get("required", []))
    if "items" in schema:
        result["items"] = structure(schema["items"], definitions)
    return result


class OutputContractTests(unittest.TestCase):
    def test_all_public_models_match_contract(self):
        count = 0
        for name, model in vars(outputs).items():
            if not isinstance(model, type) or model is outputs.Output:
                continue
            if not issubclass(model, outputs.Output):
                continue
            with self.subTest(model=name):
                actual = model.model_json_schema()
                self.assertEqual(
                    structure(actual, actual.get("$defs", {})),
                    structure(CONTRACT[name], CONTRACT),
                )
                count += 1
        self.assertEqual(count, 24)

    def test_user_drops_database_secret_and_marks_utc(self):
        user = outputs.User(
            id=1,
            name="測試",
            phone="0912345678",
            email="test@example.com",
            role="resident",
            is_active=True,
            created_at=datetime(2026, 1, 1),
            updated_at=datetime(2026, 1, 1),
            password_hash="must-not-leak",
        )
        public = user.model_dump(mode="json")
        self.assertNotIn("password_hash", public)
        self.assertEqual(public["created_at"], "2026-01-01T00:00:00Z")


if __name__ == "__main__":
    unittest.main()
