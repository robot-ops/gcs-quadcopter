from pydantic_settings import BaseSettings


class Settings(BaseSettings):

    APP_NAME: str

    MYSQL_HOST: str 
    MYSQL_PORT: int
    MYSQL_DATABASE: str
    MYSQL_USER: str
    MYSQL_PASSWORD: str

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    
    class Config:
        env_file = ".env"


settings = Settings()