"""Fictional demo venues (Istanbul); used by the seed and the static web build."""

# (name, category, lon, lat, capacity, neighborhood, district, tags, popularity)
# Fictional venues for demo purposes only. popularity 0 = always empty. No night clubs.
DEMO_VENUES = [
    # Kadıköy
    ("Demo Kafe Moda", "cafe", 29.0260, 40.9840, 40, "Moda", "Kadıköy", ["socializing"], 1.0),
    ("Demo Kafe Çarşı", "cafe", 29.0250, 40.9905, 25, "Caferağa", "Kadıköy", ["socializing"], 1.0),
    ("Demo Cowork Kadıköy", "coworking", 29.0330, 40.9880, 60, "Osmanağa", "Kadıköy", ["coworking", "quiet"], 0.8),
    ("Demo Kafe Yeldeğirmeni", "cafe", 29.0200, 40.9960, 30, "Rasimpaşa", "Kadıköy", ["quiet", "coworking"], 0.7),
    ("Demo Bar Kadife", "bar", 29.0285, 40.9875, 50, "Caferağa", "Kadıköy", ["socializing", "entertainment"], 1.0),
    ("Demo Kütüphane Moda", "library", 29.0300, 40.9815, 80, "Moda", "Kadıköy", ["quiet"], 0.6),
    ("Demo Kafe Bahariye", "cafe", 29.0310, 40.9850, 35, "Osmanağa", "Kadıköy", ["socializing"], 0.9),
    ("Demo Kafe Fenerbahçe", "cafe", 29.0370, 40.9720, 45, "Fenerbahçe", "Kadıköy", ["quiet"], 0.0),
    ("Demo Bar Moda Sahil", "bar", 29.0240, 40.9810, 60, "Moda", "Kadıköy", ["entertainment"], 0.8),
    # Beşiktaş
    ("Demo Kafe Beşiktaş", "cafe", 29.0060, 41.0430, 35, "Sinanpaşa", "Beşiktaş", ["socializing"], 1.0),
    ("Demo Bar Çarşı", "bar", 29.0045, 41.0440, 45, "Sinanpaşa", "Beşiktaş", ["socializing", "entertainment"], 1.0),
    ("Demo Cowork Levent", "coworking", 29.0110, 41.0820, 120, "Levent", "Beşiktaş", ["coworking", "quiet"], 0.9),
    ("Demo Kafe Bebek", "cafe", 29.0435, 41.0770, 30, "Bebek", "Beşiktaş", ["socializing", "quiet"], 0.8),
    ("Demo Kafe Ortaköy", "cafe", 29.0270, 41.0475, 40, "Ortaköy", "Beşiktaş", ["socializing"], 1.0),
    ("Demo Cowork Etiler", "coworking", 29.0330, 41.0800, 70, "Etiler", "Beşiktaş", ["coworking"], 0.0),
    ("Demo Kütüphane Abbasağa", "library", 29.0080, 41.0460, 60, "Abbasağa", "Beşiktaş", ["quiet"], 0.4),
    # Beyoğlu
    ("Demo Kafe Cihangir", "cafe", 28.9830, 41.0315, 20, "Cihangir", "Beyoğlu", ["quiet", "coworking"], 0.8),
    ("Demo Kafe Karaköy", "cafe", 28.9770, 41.0240, 45, "Kemankeş", "Beyoğlu", ["socializing"], 1.0),
    ("Demo Bar İstiklal", "bar", 28.9790, 41.0340, 70, "Asmalımescit", "Beyoğlu", ["socializing", "entertainment"], 1.0),
    ("Demo Kafe Galata", "cafe", 28.9740, 41.0260, 30, "Bereketzade", "Beyoğlu", ["socializing"], 1.0),
    ("Demo Cowork Tophane", "coworking", 28.9800, 41.0275, 50, "Tophane", "Beyoğlu", ["coworking", "quiet"], 0.5),
    ("Demo Bar Kurtuluş", "bar", 28.9850, 41.0450, 40, "Kurtuluş", "Şişli", ["entertainment"], 0.0),
    # Şişli
    ("Demo Cowork Şişli", "coworking", 28.9870, 41.0600, 80, "Mecidiyeköy", "Şişli", ["coworking"], 0.9),
    ("Demo Kütüphane Şişli", "library", 28.9890, 41.0560, 100, "Esentepe", "Şişli", ["quiet", "coworking"], 0.7),
    ("Demo Kafe Nişantaşı", "cafe", 28.9935, 41.0505, 35, "Teşvikiye", "Şişli", ["socializing"], 1.0),
    ("Demo Bar Bomonti", "bar", 28.9800, 41.0580, 90, "Bomonti", "Şişli", ["socializing", "entertainment"], 0.9),
    # Üsküdar
    ("Demo Kafe Üsküdar", "cafe", 29.0150, 41.0260, 30, "Mimar Sinan", "Üsküdar", ["socializing", "quiet"], 0.9),
    ("Demo Bar Üsküdar", "bar", 29.0175, 41.0245, 40, "Mimar Sinan", "Üsküdar", ["entertainment"], 0.7),
    ("Demo Kafe Kuzguncuk", "cafe", 29.0310, 41.0370, 25, "Kuzguncuk", "Üsküdar", ["quiet"], 0.5),
    ("Demo Kafe Çengelköy", "cafe", 29.0520, 41.0500, 40, "Çengelköy", "Üsküdar", ["socializing", "quiet"], 0.6),
    ("Demo Cowork Altunizade", "coworking", 29.0440, 41.0220, 90, "Altunizade", "Üsküdar", ["coworking", "quiet"], 0.8),
    # Restaurants
    ("Demo Lokanta Kadıköy", "restaurant", 29.0265, 40.9895, 60, "Caferağa", "Kadıköy", ["food"], 1.0),
    ("Demo Meyhane Moda", "restaurant", 29.0275, 40.9830, 80, "Moda", "Kadıköy", ["food", "socializing"], 0.9),
    ("Demo Restoran Ortaköy", "restaurant", 29.0280, 41.0480, 90, "Ortaköy", "Beşiktaş", ["food", "socializing"], 1.0),
    ("Demo Balıkçı Bebek", "restaurant", 29.0445, 41.0785, 50, "Bebek", "Beşiktaş", ["food"], 0.7),
    ("Demo Lokanta Karaköy", "restaurant", 28.9760, 41.0230, 45, "Kemankeş", "Beyoğlu", ["food"], 1.0),
    ("Demo Restoran Nişantaşı", "restaurant", 28.9945, 41.0515, 70, "Teşvikiye", "Şişli", ["food", "socializing"], 0.6),
    ("Demo Kebapçı Üsküdar", "restaurant", 29.0160, 41.0250, 55, "Mimar Sinan", "Üsküdar", ["food"], 0.0),
]
