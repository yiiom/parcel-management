"""其餘 35 個業務端點；薄路由只驗證輸入，交易與規則集中在服務。"""

from datetime import date
from typing import Annotated, Literal
from fastapi import APIRouter, Depends, Path, Query, Request, Response
from fastapi.responses import JSONResponse
from app.core.dependencies import get_current_user
from app.core.errors import APIError
from app.schemas.accounts import User, Error
from app.schemas.domain import (
    BuildingCreate,
    BuildingUpdate,
    NewBuildingAdmin,
    ExistingBuildingAdmin,
    UnitCreate,
    UnitUpdate,
    InviteInput,
    ParcelCreate,
    ParcelUpdate,
    VerificationCreate,
    ExceptionReport,
    ExceptionResolution,
)
from app.schemas import outputs
from app.services.transactions import transaction

router = APIRouter(
    prefix="/api",
    tags=["業務功能"],
    responses={
        c: {"model": Error} for c in (400, 401, 403, 404, 409, 410, 422, 429, 500)
    },
)
Actor = Annotated[User, Depends(get_current_user)]
Ident = Annotated[int, Path(gt=0)]
Page = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]
FilterId = Annotated[int | None, Query(gt=0)]


async def empty_body(request: Request):
    if await request.body():
        raise APIError(422, "VALIDATION_ERROR", "此操作不接受請求內容。")


@router.get(
    "/buildings",
    operation_id="list_buildings",
    response_model=outputs.BuildingPage,
    status_code=200,
)
def list_buildings(
    user: Actor, page: Page = 1, page_size: Size = 20, keyword: str | None = None
):
    with transaction(user) as s:
        return s.buildings.list_buildings(page, page_size, keyword)


@router.post(
    "/buildings",
    operation_id="create_building",
    response_model=outputs.Building,
    status_code=201,
)
def create_building(data: BuildingCreate, user: Actor):
    with transaction(user) as s:
        return s.buildings.create_building(data)


@router.get(
    "/buildings/{building_id}",
    operation_id="get_building",
    response_model=outputs.Building,
    status_code=200,
)
def get_building(building_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.buildings.get_building(building_id)


@router.patch(
    "/buildings/{building_id}",
    operation_id="update_building",
    response_model=outputs.Building,
    status_code=200,
)
def update_building(building_id: Ident, data: BuildingUpdate, user: Actor):
    with transaction(user) as s:
        return s.buildings.update_building(building_id, data)


@router.post(
    "/buildings/{building_id}/admins",
    operation_id="assign_building_admin",
    response_model=outputs.BuildingAdmin,
    status_code=201,
)
def assign_building_admin(
    building_id: Ident, data: NewBuildingAdmin | ExistingBuildingAdmin, user: Actor
):
    with transaction(user) as s:
        return s.building_admins.assign(building_id, data)


@router.get(
    "/buildings/{building_id}/admins",
    operation_id="list_building_admins",
    response_model=outputs.BuildingAdminPage,
    status_code=200,
)
def list_building_admins(
    building_id: Ident, user: Actor, page: Page = 1, page_size: Size = 20
):
    with transaction(user) as s:
        return s.building_admins.admins(building_id, page, page_size)


@router.delete(
    "/buildings/{building_id}/admins/{user_id}",
    operation_id="unassign_building_admin",
    response_class=Response,
    status_code=204,
    dependencies=[Depends(empty_body)],
)
def unassign_building_admin(building_id: Ident, user_id: Ident, user: Actor):
    with transaction(user) as s:
        s.building_admins.unassign(building_id, user_id)
    return Response(status_code=204)


@router.get(
    "/building-admins",
    operation_id="list_admin_directory",
    response_model=outputs.AdminDirectoryPage,
    status_code=200,
)
def list_admin_directory(user: Actor, page: Page = 1, page_size: Size = 20):
    with transaction(user) as s:
        return s.building_admins.directory(page, page_size)


@router.get(
    "/buildings/{building_id}/units",
    operation_id="list_units",
    response_model=outputs.UnitPage,
    status_code=200,
)
def list_units(
    building_id: Ident,
    user: Actor,
    page: Page = 1,
    page_size: Size = 20,
    floor: str | None = None,
):
    with transaction(user) as s:
        return s.units.units(building_id, page, page_size, floor)


@router.post(
    "/buildings/{building_id}/units",
    operation_id="create_unit",
    response_model=outputs.Unit,
    status_code=201,
)
def create_unit(building_id: Ident, data: UnitCreate, user: Actor):
    with transaction(user) as s:
        return s.units.create_unit(building_id, data)


@router.patch(
    "/units/{unit_id}",
    operation_id="update_unit",
    response_model=outputs.Unit,
    status_code=200,
)
def update_unit(unit_id: Ident, data: UnitUpdate, user: Actor):
    with transaction(user) as s:
        return s.units.update_unit(unit_id, data)


@router.get(
    "/units/{unit_id}/occupancies",
    operation_id="list_occupancies",
    response_model=outputs.OccupancyPage,
    status_code=200,
)
def list_occupancies(unit_id: Ident, user: Actor, page: Page = 1, page_size: Size = 20):
    with transaction(user) as s:
        return s.occupancies.occupancies(unit_id, page, page_size)


@router.post(
    "/units/{unit_id}/occupancies",
    operation_id="create_occupancy",
    response_model=outputs.Occupancy,
    status_code=201,
    dependencies=[Depends(empty_body)],
)
def create_occupancy(unit_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.occupancies.create_occupancy(unit_id)


@router.get(
    "/occupancies/{occupancy_id}/invite-codes",
    operation_id="list_invite_codes",
    response_model=outputs.InviteCodePage,
    status_code=200,
)
def list_invite_codes(
    occupancy_id: Ident, user: Actor, page: Page = 1, page_size: Size = 20
):
    with transaction(user) as s:
        return s.invitations.invites(occupancy_id, page, page_size)


@router.post(
    "/occupancies/{occupancy_id}/invite-codes",
    operation_id="create_invite_code",
    response_model=outputs.InviteCodeCreated,
    status_code=201,
    dependencies=[Depends(empty_body)],
)
def create_invite_code(occupancy_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.invitations.create_invite(occupancy_id)


@router.post(
    "/invite-codes/{code_id}/deactivate",
    operation_id="deactivate_invite_code",
    response_model=outputs.InviteCode,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def deactivate_invite_code(code_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.invitations.deactivate_invite(code_id)


@router.post(
    "/unit-invitations/verify",
    operation_id="verify_unit_invitation",
    response_model=outputs.InvitationVerified,
    status_code=200,
)
def verify_unit_invitation(data: InviteInput, user: Actor):
    with transaction(user) as s:
        return s.invitations.verify_invite(data.invite_code)


@router.get(
    "/buildings/{building_id}/memberships",
    operation_id="list_memberships",
    response_model=outputs.MembershipPage,
    status_code=200,
)
def list_memberships(
    building_id: Ident,
    user: Actor,
    page: Page = 1,
    page_size: Size = 20,
    unit_id: FilterId = None,
    status: Literal["active", "exit_requested", "revoked"] | None = None,
    occupancy_id: FilterId = None,
):
    with transaction(user) as s:
        return s.memberships.memberships(
            building_id, page, page_size, unit_id, status, occupancy_id
        )


@router.post(
    "/unit-memberships/{membership_id}/exit-request",
    operation_id="request_exit",
    response_model=outputs.Membership,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def request_exit(membership_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.memberships.request_exit(membership_id)


@router.post(
    "/unit-memberships/{membership_id}/revoke",
    operation_id="revoke_membership",
    response_model=outputs.Membership,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def revoke_membership(membership_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.memberships.revoke(membership_id)


@router.get(
    "/parcels",
    operation_id="list_parcels",
    response_model=outputs.ParcelPage,
    status_code=200,
)
def list_parcels(
    user: Actor,
    page: Page = 1,
    page_size: Size = 20,
    building_id: FilterId = None,
    unit_id: FilterId = None,
    status: Literal["pending", "picked_up", "exception", "returned"] | None = None,
    keyword: str | None = None,
    occupancy_id: FilterId = None,
):
    with transaction(user) as s:
        return s.parcels.parcels(
            page, page_size, building_id, unit_id, status, keyword, occupancy_id
        )


@router.get(
    "/parcels/{parcel_id}",
    operation_id="get_parcel",
    response_model=outputs.Parcel,
    status_code=200,
)
def get_parcel(parcel_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.parcels.parcel_view(s.parcels.parcel(parcel_id))


@router.patch(
    "/parcels/{parcel_id}",
    operation_id="update_parcel",
    response_model=outputs.Parcel,
    status_code=200,
)
def update_parcel(parcel_id: Ident, data: ParcelUpdate, user: Actor):
    with transaction(user) as s:
        return s.parcels.update_parcel(parcel_id, data)


@router.get(
    "/parcels/{parcel_id}/pickup-code",
    operation_id="get_pickup_code",
    response_model=outputs.PickupCode,
    status_code=200,
)
def get_pickup_code(parcel_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.parcels.pickup_code(parcel_id)


@router.post(
    "/pickup-verifications",
    operation_id="create_pickup_verification",
    response_model=outputs.PickupVerification,
    status_code=200,
)
def create_pickup_verification(data: VerificationCreate, user: Actor):
    with transaction(user) as s:
        return s.pickups.verify_pickup(data)


@router.get(
    "/pickup-verifications/{verification_id}",
    operation_id="get_pickup_verification",
    response_model=outputs.PickupVerification,
    status_code=200,
)
def get_pickup_verification(verification_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.pickups.verification_view(s.pickups.verification(verification_id))


@router.post(
    "/pickup-verifications/{verification_id}/confirm",
    operation_id="confirm_pickup",
    response_model=outputs.Pickup,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def confirm_pickup(verification_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.pickups.confirm(verification_id)


@router.post(
    "/pickup-verifications/{verification_id}/cancel",
    operation_id="cancel_pickup_verification",
    response_model=outputs.PickupVerification,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def cancel_pickup_verification(verification_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.pickups.cancel_verification(verification_id)


@router.get(
    "/pickups",
    operation_id="list_pickups",
    response_model=outputs.PickupPage,
    status_code=200,
)
def list_pickups(
    user: Actor,
    page: Page = 1,
    page_size: Size = 20,
    building_id: FilterId = None,
    unit_id: FilterId = None,
    occupancy_id: FilterId = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    with transaction(user) as s:
        return s.pickups.pickups(
            page, page_size, building_id, unit_id, occupancy_id, date_from, date_to
        )


@router.put(
    "/parcels/{parcel_id}/exception",
    operation_id="report_parcel_exception",
    response_model=outputs.Parcel,
    status_code=200,
)
def report_parcel_exception(parcel_id: Ident, data: ExceptionReport, user: Actor):
    with transaction(user) as s:
        return s.exceptions.report_exception(parcel_id, data.exception_reason)


@router.post(
    "/parcels/{parcel_id}/exception/resolve",
    operation_id="resolve_parcel_exception",
    response_model=outputs.Parcel,
    status_code=200,
)
def resolve_parcel_exception(parcel_id: Ident, data: ExceptionResolution, user: Actor):
    with transaction(user) as s:
        return s.exceptions.resolve_exception(parcel_id, data)


@router.post(
    "/occupancies/{occupancy_id}/end",
    operation_id="end_occupancy",
    response_model=outputs.Occupancy,
    status_code=200,
    dependencies=[Depends(empty_body)],
)
def end_occupancy(occupancy_id: Ident, user: Actor):
    with transaction(user) as s:
        return s.occupancies.end_occupancy(occupancy_id)


@router.post(
    "/unit-memberships",
    operation_id="join_unit",
    response_model=outputs.Membership,
    status_code=201,
    responses={200: {"model": outputs.Membership}},
)
def join_unit(data: InviteInput, user: Actor, response: Response):
    with transaction(user) as s:
        result, created = s.invitations.verify_invite(data.invite_code, True)
        response.status_code = 201 if created else 200
        return result


@router.post(
    "/parcels",
    operation_id="create_parcel",
    response_model=outputs.Parcel,
    status_code=201,
    responses={409: {"model": outputs.DuplicateParcelWarning | Error}},
)
def create_parcel(data: ParcelCreate, user: Actor):
    with transaction(user) as s:
        result, status = s.parcels.create_parcel(data)
        if status == 409:
            return JSONResponse(
                status_code=409,
                content=outputs.DuplicateParcelWarning.model_validate(
                    result
                ).model_dump(mode="json"),
            )
        return result


@router.delete(
    "/buildings/{building_id}",
    operation_id="delete_building",
    response_class=Response,
    status_code=204,
    dependencies=[Depends(empty_body)],
)
def delete_building(building_id: Ident, user: Actor):
    with transaction(user) as s:
        s.buildings.delete_building(building_id)
    return Response(status_code=204)
