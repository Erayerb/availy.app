import pytest

from app.venues import escape_like, parse_tags


def test_parse_tags_empty_means_no_filter():
    assert parse_tags(None) == []
    assert parse_tags("") == []


def test_parse_tags_dedupes_and_trims():
    assert parse_tags(" quiet,coworking,quiet ") == ["coworking", "quiet"]


def test_parse_tags_rejects_unknown():
    with pytest.raises(ValueError, match="party"):
        parse_tags("quiet,party")


def test_escape_like():
    assert escape_like("50%_off\\") == "50\\%\\_off\\\\"
    assert escape_like("Kafe") == "Kafe"


def test_parse_tags_accepts_food():
    assert parse_tags("food,quiet") == ["food", "quiet"]


def test_fold_tr():
    from app.venues import fold_tr

    assert fold_tr("Nişantaşı") == "nisantasi"
    assert fold_tr("İSTANBUL Üsküdar Çengelköy Ağa") == "istanbul uskudar cengelkoy aga"
