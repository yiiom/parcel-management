"""對外回應的明確欄位白名單。

修改欄位時同步 Swagger 來源；不在執行時動態產生類別。
資料庫多出的密碼雜湊、碼密文等欄位會被 Output 排除。
"""

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Output(BaseModel):
    model_config = ConfigDict(extra="ignore")

    @field_validator("*", mode="before")
    @classmethod
    def utc(cls, value):
        if isinstance(value, datetime) and value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


class AdminDirectoryEntry(Output):
    user_id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=100)
    building_id: int | None = Field(ge=1)
    building_name: str | None


class AdminDirectoryPage(Output):
    items: list[AdminDirectoryEntry]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class Building(Output):
    can_delete: bool
    id: int = Field(ge=1)
    name: str = Field(max_length=100)
    address: str = Field(max_length=255)
    phone: str | None = Field(min_length=8, max_length=20)
    created_at: datetime
    updated_at: datetime


class User(Output):
    id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=8, max_length=20)
    email: str = Field(max_length=255)
    role: Literal["system_admin", "building_admin", "resident"]
    created_at: datetime
    is_active: bool
    updated_at: datetime


class BuildingAdmin(Output):
    building_id: int = Field(ge=1)
    user: User
    id: int = Field(ge=1)
    created_at: datetime


class BuildingAdminPage(Output):
    items: list[BuildingAdmin]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class BuildingPage(Output):
    items: list[Building]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class Parcel(Output):
    id: int = Field(ge=1)
    building_id: int = Field(ge=1)
    unit_id: int = Field(ge=1)
    unit_label: str
    recipient_name: str = Field(min_length=1, max_length=100)
    tracking_number: str | None
    note: str | None
    status: Literal["pending", "picked_up", "exception", "returned"]
    created_by: int = Field(ge=1)
    picked_up_at: datetime | None
    active_verification_id: int | None = Field(ge=1)
    occupancy_id: int = Field(ge=1)
    courier: str | None
    created_at: datetime
    storage_location: str | None
    updated_at: datetime
    exception_reason: str | None
    exception_reported_by: int | None
    exception_reported_at: datetime | None
    resolution_note: str | None
    resolved_by: int | None
    resolved_at: datetime | None


class DuplicateParcelWarning(Output):
    code: Literal["DUPLICATE_PARCEL_CONFIRMATION_REQUIRED"]
    message: str
    existing_parcels: list[Parcel]


class InvitationVerified(Output):
    building_id: int = Field(ge=1)
    building_name: str
    unit_id: int = Field(ge=1)
    unit_label: str
    expires_at: datetime
    occupancy_id: int = Field(ge=1)


class InviteCode(Output):
    id: int = Field(ge=1)
    occupancy_id: int = Field(ge=1)
    status: Literal["active", "expired", "inactive"]
    expires_at: datetime
    disabled_at: datetime | None
    created_by: int = Field(ge=1)
    created_at: datetime


class InviteCodeCreated(Output):
    id: int = Field(ge=1)
    occupancy_id: int = Field(ge=1)
    status: Literal["active", "expired", "inactive"]
    expires_at: datetime
    disabled_at: datetime | None
    created_by: int = Field(ge=1)
    created_at: datetime
    code: str = Field(pattern="^[0-9]{4}$")


class InviteCodePage(Output):
    items: list[InviteCode]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class Membership(Output):
    id: int = Field(ge=1)
    user_id: int = Field(ge=1)
    user_name: str = Field(min_length=1, max_length=100)
    building_id: int = Field(ge=1)
    building_name: str
    unit_id: int = Field(ge=1)
    unit_label: str
    status: Literal["active", "exit_requested", "revoked"]
    joined_at: datetime
    left_at: datetime | None
    occupancy_id: int = Field(ge=1)
    exit_requested_at: datetime | None
    revoked_by: int | None


class MembershipPage(Output):
    items: list[Membership]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class Occupancy(Output):
    id: int = Field(ge=1)
    unit_id: int = Field(ge=1)
    started_at: datetime
    ended_at: datetime | None
    created_at: datetime


class OccupancyPage(Output):
    items: list[Occupancy]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class ParcelPage(Output):
    items: list[Parcel]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class Pickup(Output):
    id: int = Field(ge=1)
    parcel_id: int = Field(ge=1)
    verification_id: int = Field(ge=1)
    unit_label: str
    tracking_number: str | None
    handled_by: int = Field(ge=1)
    handled_by_name: str
    occupancy_id: int = Field(ge=1)
    courier: str | None
    picked_up_by: int = Field(ge=1)
    picked_up_by_name: str = Field(min_length=1, max_length=100)
    picked_up_at: datetime
    building_name: str
    floor: str
    recipient_name: str = Field(min_length=1, max_length=100)


class PickupCode(Output):
    parcel_id: int = Field(ge=1)
    pickup_code: str = Field(pattern="^[0-9]{6}$")


class PickupPage(Output):
    items: list[Pickup]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class PickupVerification(Output):
    id: int = Field(ge=1)
    parcel_id: int = Field(ge=1)
    unit_label: str
    status: Literal["awaiting_confirmation", "completed", "expired", "cancelled"]
    verified_by: int = Field(ge=1)
    verified_at: datetime
    expires_at: datetime
    pickup_id: int | None = Field(ge=1)
    courier: str | None
    updated_at: datetime


class Unit(Output):
    id: int = Field(ge=1)
    building_id: int = Field(ge=1)
    floor: str
    unit_number: str = Field(max_length=20)
    label: str
    created_at: datetime
    updated_at: datetime


class UnitPage(Output):
    items: list[Unit]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
