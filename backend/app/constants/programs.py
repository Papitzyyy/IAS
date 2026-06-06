"""EVSU Ormoc Campus program catalog — keep in sync with frontend constants/programs.js.

NOTE: All codes are stored UPPERCASE in the database (the validator calls .upper()).
      Keep codes here in uppercase to match exactly.
"""

EVSU_PROGRAMS = [
    {
        "department": "Engineering Department",
        "programs": [
            {"code": "BSCE", "label": "BSCE – Bachelor of Science in Civil Engineering"},
            {"code": "BSEE", "label": "BSEE – Bachelor of Science in Electrical Engineering"},
            {"code": "BSME", "label": "BSME – Bachelor of Science in Mechanical Engineering"},
        ],
    },
    {
        "department": "Information Technology Department",
        "programs": [
            {"code": "BSIT", "label": "BSIT – Bachelor of Science in Information Technology"},
        ],
    },
    {
        "department": "Industrial Technology Department",
        "programs": [
            {"code": "BSHM", "label": "BSHM – Bachelor of Science in Hospitality Management"},
        ],
    },
    {
        "department": "Teacher Education Department",
        "programs": [
            {"code": "BEED", "label": "BEED – Bachelor in Elementary Education"},
            {"code": "BSED", "label": "BSEd – Bachelor of Secondary Education (Majors: Mathematics, Science)"},
            {"code": "BCAED", "label": "BCAEd – Bachelor of Culture & Arts Education"},
            {"code": "BPED", "label": "BPEd – Bachelor of Physical Education"},
        ],
    },
]

VALID_PROGRAM_CODES = {
    p["code"]
    for dept in EVSU_PROGRAMS
    for p in dept["programs"]
}
