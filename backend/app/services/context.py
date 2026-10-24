"""單次交易的服務集合；所有服務共用連線、游標與登入身分。"""

from app.services.permissions import PermissionService
from app.services.buildings import BuildingService
from app.services.building_admins import BuildingAdminService
from app.services.units import UnitService
from app.services.occupancies import OccupancyService
from app.services.invitations import InvitationService
from app.services.code_attempts import CodeAttemptService
from app.services.memberships import MembershipService
from app.services.parcels import ParcelService
from app.services.pickups import PickupService
from app.services.exceptions import ExceptionService


class ServiceContext:
    def __init__(self, db, cursor, user):
        self.db, self.c, self.user = db, cursor, user
        self.permissions = PermissionService(self)
        self.buildings = BuildingService(self)
        self.building_admins = BuildingAdminService(self)
        self.units = UnitService(self)
        self.occupancies = OccupancyService(self)
        self.invitations = InvitationService(self)
        self.code_attempts = CodeAttemptService(self)
        self.memberships = MembershipService(self)
        self.parcels = ParcelService(self)
        self.pickups = PickupService(self)
        self.exceptions = ExceptionService(self)
