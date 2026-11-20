import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey, Index, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    auth_user_id = Column(String(255), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    display_name = Column(String(255), nullable=False, default="User")
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    owned_investigations = relationship("Investigation", back_populates="owner", cascade="all, delete-orphan")
    shared_access = relationship("InvestigationAccess", back_populates="user", cascade="all, delete-orphan")
    annotations = relationship("UserAnnotation", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("AIConversation", back_populates="user", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="owner", cascade="all, delete-orphan")


class Source(Base):
    __tablename__ = "sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    canonical_domain = Column(String(255), unique=True, nullable=False, index=True)
    source_name = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False, default="publisher")
    political_perspective = Column(String(50), nullable=False, default="unknown")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    documents = relationship("Document", back_populates="source")


class Investigation(Base):
    __tablename__ = "investigations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    topic = Column(String(255), nullable=False, index=True)
    search_query = Column(Text, nullable=True)
    start_year = Column(Integer, nullable=False, default=2021)
    end_year = Column(Integer, nullable=False, default=2024)
    status = Column(String(50), nullable=False, default="pending", index=True)
    summary_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="owned_investigations")
    access_list = relationship("InvestigationAccess", back_populates="investigation", cascade="all, delete-orphan")
    jobs = relationship("InvestigationJob", back_populates="investigation", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="investigation", cascade="all, delete-orphan")
    claim_clusters = relationship("ClaimCluster", back_populates="investigation", cascade="all, delete-orphan")
    narratives = relationship("NarrativeEvolution", back_populates="investigation", cascade="all, delete-orphan")
    sentiments = relationship("SentimentRecord", back_populates="investigation", cascade="all, delete-orphan")
    divergences = relationship("SourceDivergenceRecord", back_populates="investigation", cascade="all, delete-orphan")
    decompositions = relationship("IntelligenceDecomposition", back_populates="investigation", cascade="all, delete-orphan")
    annotations = relationship("UserAnnotation", back_populates="investigation", cascade="all, delete-orphan")
    ai_conversations = relationship("AIConversation", back_populates="investigation", cascade="all, delete-orphan")
    articles = relationship("Article", back_populates="investigation")


class InvestigationAccess(Base):
    __tablename__ = "investigation_access"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        UniqueConstraint("investigation_id", "user_id", name="uq_investigation_user_access"),
    )

    investigation = relationship("Investigation", back_populates="access_list")
    user = relationship("User", back_populates="shared_access")


class InvestigationJob(Base):
    __tablename__ = "investigation_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    job_status = Column(String(50), nullable=False, default="queued", index=True)
    progress = Column(Float, nullable=False, default=0.0)
    stage = Column(String(50), nullable=False, default="created")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="jobs")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    source_id = Column(String(36), ForeignKey("sources.id", ondelete="SET NULL"), nullable=True, index=True)
    canonical_url = Column(Text, nullable=False, index=True)
    content_hash = Column(String(64), nullable=False, index=True)
    title = Column(Text, nullable=False)
    author = Column(String(255), nullable=True)
    publication_date = Column(DateTime(timezone=True), nullable=True, index=True)
    published_year = Column(Integer, nullable=True, index=True)
    raw_content = Column(Text, nullable=True)
    cleaned_content = Column(Text, nullable=True)
    extraction_status = Column(String(50), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="documents")
    source = relationship("Source", back_populates="documents")
    claims = relationship("Claim", back_populates="document", cascade="all, delete-orphan")
    evidence_items = relationship("EvidenceRecord", back_populates="document", cascade="all, delete-orphan")
    provenance = relationship("ProvenanceRecord", back_populates="document", cascade="all, delete-orphan")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    claim_text = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False, default=1.0)
    category = Column(String(100), nullable=True)
    source_name = Column(String(255), nullable=True)
    publication_date = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    document = relationship("Document", back_populates="claims")
    evidence_items = relationship("EvidenceRecord", back_populates="claim", cascade="all, delete-orphan")


class ClaimCluster(Base):
    __tablename__ = "claim_clusters"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    cluster_label = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    year = Column(Integer, nullable=False, index=True)
    member_claims_count = Column(Integer, nullable=False, default=0)
    unclustered_flag = Column(String(10), nullable=False, default="false")
    supporting_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="claim_clusters")


class NarrativeEvolution(Base):
    __tablename__ = "narrative_evolutions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    narrative_summary = Column(Text, nullable=False)
    shift_delta = Column(Float, nullable=False, default=0.0)
    transition_type = Column(String(50), nullable=False, default="persistent")
    supporting_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="narratives")


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    claim_id = Column(String(36), ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    quote = Column(Text, nullable=False)
    start_char = Column(Integer, nullable=False, default=0)
    end_char = Column(Integer, nullable=False, default=0)
    evidence_type = Column(String(50), nullable=False, default="direct_quote")
    extraction_method = Column(String(50), nullable=False, default="exact_substring")
    sentiment_label = Column(String(50), nullable=True)
    perspective = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    claim = relationship("Claim", back_populates="evidence_items")
    document = relationship("Document", back_populates="evidence_items")


class ProvenanceRecord(Base):
    __tablename__ = "provenance_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    fetched_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    fetch_method = Column(String(50), nullable=False, default="rss")
    http_status = Column(Integer, nullable=False, default=200)
    checksum = Column(String(64), nullable=True)
    pipeline_version = Column(String(50), nullable=False, default="3.0.0")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    document = relationship("Document", back_populates="provenance")


class SentimentRecord(Base):
    __tablename__ = "sentiment_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    positive_pct = Column(Float, nullable=False, default=0.0)
    negative_pct = Column(Float, nullable=False, default=0.0)
    neutral_pct = Column(Float, nullable=False, default=0.0)
    total_articles = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="sentiments")


class SourceDivergenceRecord(Base):
    __tablename__ = "source_divergence_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    comparison_group = Column(String(100), nullable=False, default="publisher")
    perspective = Column(String(50), nullable=False)
    divergence_score = Column(Float, nullable=False, default=0.0)
    divergence_type = Column(String(50), nullable=False, default="semantic")
    sample_size = Column(Integer, nullable=False, default=0)
    data_status = Column(String(50), nullable=False, default="sufficient")
    notes = Column(Text, nullable=True)
    supporting_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="divergences")


class IntelligenceDecomposition(Base):
    __tablename__ = "intelligence_decompositions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    dimension_name = Column(String(100), nullable=False, index=True)
    magnitude_score = Column(Float, nullable=False, default=0.0)
    affected_years = Column(String(50), nullable=True)
    phrasing_context = Column(Text, nullable=False)
    supporting_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="decompositions")



class Article(Base):
    __tablename__ = 'articles'

    id = Column(String(36), primary_key=True, default=generate_uuid)
    owner_user_id = Column(String(255), ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    investigation_id = Column(String(36), ForeignKey('investigations.id', ondelete='SET NULL'), nullable=True)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    body = Column(Text, nullable=False, default='')
    author_name = Column(String(255), nullable=False)  # display name, set from user profile
    visibility = Column(String(20), nullable=False, default='private')  # 'private', 'shared', 'public'
    shared_with = Column(JSON, nullable=True)  # list of user IDs for 'shared' visibility
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    owner = relationship('User', back_populates='articles')
    investigation = relationship('Investigation', back_populates='articles')


class UserAnnotation(Base):
    __tablename__ = "user_annotations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(50), nullable=False, default="investigation")
    target_id = Column(String(255), nullable=False, index=True)
    note_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="annotations")
    user = relationship("User", back_populates="annotations")


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    investigation_id = Column(String(36), ForeignKey("investigations.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False, default="NarrativeShift Chat")
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    investigation = relationship("Investigation", back_populates="ai_conversations")
    user = relationship("User", back_populates="conversations")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    conversation_id = Column(String(36), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_role = Column(String(50), nullable=False, default="user")
    content = Column(Text, nullable=False)
    context_data = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    conversation = relationship("AIConversation", back_populates="messages")
