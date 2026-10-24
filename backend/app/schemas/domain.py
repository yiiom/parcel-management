"""業務輸入白名單；省略與顯式 null 分開處理。"""

from typing import Annotated, Literal
from pydantic import Field, StringConstraints, model_validator
from pydantic import ConfigDict
from app.schemas.accounts import Input, Name, Phone, RegisterRequest

Id = Annotated[int, Field(strict=True, gt=0)]
Text20 = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)
]
Text100 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]
Address = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]
RequiredText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Partial(Input):
    model_config = ConfigDict(extra="forbid", json_schema_extra={"minProperties": 1})

    @model_validator(mode="after")
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError("至少提供一個欄位。")
        return self


class BuildingCreate(Input):
    name: Name
    address: Address
    phone: Phone | None = None


class BuildingUpdate(Partial):
    name: Name = None
    address: Address = None
    phone: Phone | None = None


class ExistingBuildingAdmin(Input):
    user_id: Id


class NewBuildingAdmin(RegisterRequest):
    pass


class UnitCreate(Input):
    floor: Text20
    unit_number: Text20


class UnitUpdate(Partial):
    floor: Text20 = None
    unit_number: Text20 = None


class InviteInput(Input):
    invite_code: Annotated[
        str, StringConstraints(pattern=r"^[0-9]{4}$", min_length=4, max_length=4)
    ]


class ParcelCreate(Input):
    occupancy_id: Id
    recipient_name: Name
    courier: Text100 | None = None
    tracking_number: Text100 | None = None
    storage_location: Text100 | None = None
    note: str | None = None
    duplicate_confirmed: bool = Field(default=False, strict=True)


class ParcelUpdate(Partial):
    occupancy_id: Id = None
    recipient_name: Name = None
    courier: Text100 | None = None
    tracking_number: Text100 | None = None
    storage_location: Text100 | None = None
    note: str | None = None


class VerificationCreate(Input):
    building_id: Id
    pickup_code: Annotated[
        str, StringConstraints(pattern=r"^[0-9]{6}$", min_length=6, max_length=6)
    ]


class ExceptionReport(Input):
    exception_reason: RequiredText


class ExceptionResolution(Input):
    status: Literal["pending", "returned"]
    resolution_note: RequiredText
