class ServiceError(Exception):
    """业务逻辑异常，由 Service 层抛出，路由层转换为 HTTPException"""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)
