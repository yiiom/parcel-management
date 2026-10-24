from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)
]
Phone = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=8, max_length=20)
]
Password = Annotated[str, StringConstraints(min_length=8, max_length=128)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginRequest(Input):
    email: EmailStr = Field(max_length=255)
    password: Password = Field(
        json_schema_extra={"writeOnly": True, "format": "password"}
    )

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


class RegisterRequest(LoginRequest):
    name: Name
    phone: Phone


class ProfileUpdate(Input):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"minProperties": 1})
    name: Name = None
    phone: Phone = None

    @model_validator(mode="after")
    def not_empty(self):
        if not self.model_fields_set:
            raise ValueError("至少提供姓名或電話。")
        return self


class User(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    role: Literal["system_admin", "building_admin", "resident"]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @field_validator("created_at", "updated_at")
    @classmethod
    def utc_datetime(cls, value):
        return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


from app.schemas.outputs import Membership


class Me(BaseModel):
    user: User
    memberships: list[Membership]
    managed_building_ids: list[int]


class ErrorDetail(BaseModel):
    field: str
    message: str


class Error(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None
