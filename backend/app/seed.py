"""Seed default rubric criteria, the NxtWave banned-projects list, and the admin user.
Idempotent: safe to run on every startup."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import BannedProject, Criterion, User
from app.security import hash_password

DEFAULT_CRITERIA: list[dict] = [
    {
        "key": "no_internal_projects",
        "category": "dont",
        "title": "No NxtWave internal projects",
        "description": (
            "Projects must be self-made. The resume must NOT present any NxtWave internal/"
            "portal projects (e.g. Nxt Trendz, Jobby App, Nxt Watch, Tasty Kitchens, etc.) "
            "as the candidate's own work. Fail if any banned internal project appears."
        ),
        "weight": 3.0,
        "is_critical": True,
    },
    {
        "key": "project_links_present",
        "category": "do",
        "title": "GitHub + deployed link for every project",
        "description": (
            "Every project listed must include BOTH a GitHub repository link and a live/"
            "deployed link. Fail if any project is missing either link."
        ),
        "weight": 2.0,
        "is_critical": False,
    },
    {
        "key": "no_nxtwave_experience",
        "category": "dont",
        "title": "NxtWave training not listed as experience",
        "description": (
            "The Experience/Work section must NOT include NxtWave training, coursework, or "
            "the NxtWave program as professional experience. Fail if it does."
        ),
        "weight": 2.0,
        "is_critical": True,
    },
    {
        "key": "coding_profile_present",
        "category": "do",
        "title": "Coding profile link included",
        "description": (
            "The resume must include at least one coding profile link (LeetCode, HackerRank, "
            "CodeChef, Codeforces, etc.) so programming knowledge can be evaluated. "
            "Prefer LeetCode. Fail if no coding profile link is present."
        ),
        "weight": 2.0,
        "is_critical": False,
    },
    {
        "key": "skills_grouped",
        "category": "do",
        "title": "Skills grouped into sections",
        "description": (
            "Skills must be organized into clear sections such as Frontend, Backend, "
            "Databases, AI/ML, Tools, etc. — not a single flat, uncategorized list."
        ),
        "weight": 1.0,
        "is_critical": False,
    },
    # Note: certifications are handled as a coaching suggestion (internal NxtWave certs are
    # allowed; an external cert is encouraged), not a pass/fail rubric rule.
]

BANNED_PROJECTS: list[str] = [
    "Tourism website",
    "Conference Page",
    "Podcast Page",
    "My Projects Page",
    "Bookstore Page",
    "Music Page - Buffer",
    "Food munch",
    "Ecommerce",
    "VR Products Store",
    "VR Website",
    "Portfolio",
    "Todos Application",
    "Countries List",
    "Chatbot",
    "Bookmark Marker",
    "Wikipedia Search Application",
    "API Testing Console",
    "Go REST Console",
    "Speed Typing Test",
    "Book Store",
    "Book Search",
    "Random Joke - Buffer",
    "Know Fact About the Number - Buffer",
    "Word Cloud - Buffer",
    "Emoji Game",
    "Blog List",
    "Cryptocurrency Tracker",
    "Github Popular Repos",
    "IPL Dashboard",
    "Nxt Trendz",
    "ECommerce Clone",
    "Jobby App",
    "Nxt Watch",
    "Coding-x",
    "Movies App",
    "Netflix Clone",
    "Amazon Prime Clone",
    "Covid Dashboard",
    "Tasty Kitchens",
    "Swiggy Clone",
    "Zomato Clone",
    "Spotify Remix",
    "Spotify Clone",
    "Mini Games",
    "Github Profile Visualizer",
    "Book Hub",
    "Goodreads Clone",
    "Nxt Assess",
    "Quiz Game",
    "Instagram clone",
    "Travel trip",
    "Daily mood tracker",
    "Rock Paper Scissors Game",
]


def seed_criteria(db: Session) -> None:
    for spec in DEFAULT_CRITERIA:
        exists = db.scalar(select(Criterion).where(Criterion.key == spec["key"]))
        if not exists:
            db.add(Criterion(**spec))
    db.commit()


def seed_banned_projects(db: Session) -> None:
    for name in BANNED_PROJECTS:
        exists = db.scalar(select(BannedProject).where(BannedProject.name == name))
        if not exists:
            db.add(BannedProject(name=name))
    db.commit()


def seed_admin(db: Session) -> None:
    exists = db.scalar(select(User).where(User.email == settings.admin_email))
    if not exists:
        db.add(
            User(
                email=settings.admin_email,
                full_name="Administrator",
                hashed_password=hash_password(settings.admin_password),
                role="admin",
            )
        )
        db.commit()


def run_all(db: Session) -> None:
    seed_criteria(db)
    seed_banned_projects(db)
    seed_admin(db)
