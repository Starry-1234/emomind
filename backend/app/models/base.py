from datetime import datetime, timedelta, timezone

from sqlmodel import Field, SQLModel


def get_utc_now() -> datetime:
    """返回当前 UTC 时间（naive datetime）"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_cst_now() -> datetime:
    """返回北京时间（naive datetime，配合 TIMESTAMP WITHOUT TIMEZONE 使用）"""
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)  # type: ignore
