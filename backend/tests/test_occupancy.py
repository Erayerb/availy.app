import pytest

from app.occupancy import Level, classify


@pytest.mark.parametrize(
    ("ratio", "expected"),
    [
        (0.0, Level.LOW),
        (0.39, Level.LOW),
        (0.40, Level.MEDIUM),
        (0.75, Level.MEDIUM),
        (0.76, Level.HIGH),
        (1.0, Level.HIGH),
    ],
)
def test_classify_thresholds(ratio, expected):
    assert classify(ratio) == expected
