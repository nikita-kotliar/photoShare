# Модель даних (Data Model) — PhotoShare

Документ містить описи таблиць, зв'язків, типів даних, обмежень, індексів та ER-діаграму бази даних PostgreSQL.

---

## ER-Діаграма (Mermaid)

```mermaid
erDiagram
    Role {
        enum id PK
    }

    User ||--o{ Photo : "creates"
    User ||--o{ Comment : "writes"
    User ||--o{ Rating : "rates"
    User }|--|| Role : "has"

    Photo ||--o{ Comment : "has"
    Photo ||--o{ Rating : "has"
    Photo ||--o{ TransformedLink : "has"
    Photo ||--o{ PhotoTag : "tagged with"
    Tag ||--o{ PhotoTag : "belongs to"

    User {
        uuid id PK
        string email UK
        string username UK
        string password_hash
        string role
        boolean is_banned
        timestamp created_at
        timestamp updated_at
    }

    Photo {
        uuid id PK
        uuid user_id FK
        string url
        string public_id
        text description
        timestamp created_at
        timestamp updated_at
    }

    Tag {
        uuid id PK
        string name UK
        timestamp created_at
    }

    PhotoTag {
        uuid photo_id PK, FK
        uuid tag_id PK, FK
    }

    Comment {
        uuid id PK
        uuid photo_id FK
        uuid user_id FK
        text content
        timestamp created_at
        timestamp updated_at
    }

    Rating {
        uuid id PK
        uuid photo_id FK
        uuid user_id FK
        integer value
        timestamp created_at
    }

    TransformedLink {
        uuid id PK
        uuid photo_id FK
        string url
        string qr_code_url
        string transformation_params
        timestamp created_at
    }

    TokenBlacklist {
        uuid id PK
        string token_jti UK
        timestamp expires_at
        timestamp created_at
    }
    