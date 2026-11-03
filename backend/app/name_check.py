"""v2: what a venue's name may not be, checked before anyone else can see it. It cannot catch everything:
"Uygunsuz ad" reports and the admin's list of pending venues do the rest."""
import re

from app.venues import fold_tr

# Whole words only: "sik" must not catch "Sikke". Written in the folded form (no Turkish letters, no repeats)
BAD_WORDS = {
    "amk", "aq", "sik", "siktir", "sikerim", "sikis", "sikik", "yarak", "orospu", "pezevenk", "ibne", "gavat",
    "kahpe", "surtuk", "amcik", "fuck", "shit", "bitch", "porn", "porno",
}
# Before folding: folded they are ordinary words ("got", "pic")
BAD_TURKISH_WORDS = {"göt", "piç", "oç"}
# Hidden inside a longer word too
BAD_PARTS = ("orospu", "yarak", "pezevenk", "siktir", "sikerim", "amcik", "aminako", "fuck")
LOOKALIKES = str.maketrans("013457@$", "oieastas")
LINK = re.compile(r"https?://|www\.|\.(com|net|org|io|app|tr)\b|@\w", re.IGNORECASE)
MIN_LETTERS_FOR_CAPITALS = 5  # short names may well be "BAP"
MIN_PHONE_DIGITS = 7


def _plain(text: str) -> str:
    """Folded, digits read as letters, no repeated letters: "0r0ssspu" -> "orospu"."""
    return re.sub(r"(.)\1+", r"\1", fold_tr(text).translate(LOOKALIKES))


def name_problem(name: str) -> str | None:
    """Why this cannot be a venue's name, as the person adding it should read it (None: it can)."""
    if LINK.search(name):
        return "Mekanın adına bağlantı ya da kullanıcı adı yazma."
    if sum(c.isdigit() for c in name) >= MIN_PHONE_DIGITS:
        return "Mekanın adına telefon numarası yazma."
    letters = [c for c in name if c.isalpha()]
    if len(letters) >= MIN_LETTERS_FOR_CAPITALS and all(c.isupper() for c in letters):
        return 'Adı tamamı büyük harfle yazma: "Moda Kahve Evi" gibi.'
    plain = _plain(name)
    raw_words = set(re.findall(r"\w+", name.replace("I", "ı").replace("İ", "i").lower()))
    if set(re.findall(r"\w+", plain)) & BAD_WORDS or raw_words & BAD_TURKISH_WORDS or any(p in plain for p in BAD_PARTS):
        return "Bu ad kullanılamaz. Mekanın gerçek adını yaz."
    return None
