import pytest

from app.venues import BBox, parse_bbox


def test_parse_valid_bbox():
    assert parse_bbox("29.0,40.9,29.1,41.0") == BBox(29.0, 40.9, 29.1, 41.0)


@pytest.mark.parametrize(
    "raw",
    [
        "29.0,40.9,29.1",  # too few values
        "a,b,c,d",  # not numbers
        "200,40,201,41",  # longitude out of range
        "29,95,30,96",  # latitude out of range
        "29.1,40.9,29.0,41.0",  # min > max
        "29.0,40.9,29.0,41.0",  # zero width
    ],
)
def test_parse_invalid_bbox(raw):
    with pytest.raises(ValueError):
        parse_bbox(raw)
