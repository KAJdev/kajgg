import re

DEAL_DAMAGE_PATTERN = re.compile(
    r"Deal\s+(\d+)\s+to\s+(.+?)(?:\.|$|If|,)",
    re.IGNORECASE
)

DRAW_PATTERN = re.compile(
    r"draw\s+(\d+)",
    re.IGNORECASE
)

DISCARD_PATTERN = re.compile(
    r"discard\s+(\d+)",
    re.IGNORECASE
)

GIVE_BUFF_PATTERN = re.compile(
    r"Give\s+(.+?)\s+\+(\d+)\s+S(?:\s+this\s+turn)?",
    re.IGNORECASE
)

KILL_PATTERN = re.compile(
    r"Kill\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

MOVE_PATTERN = re.compile(
    r"Move\s+(.+?)\s+(?:from|to)\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

RECALL_PATTERN = re.compile(
    r"(?:Recall|return)\s+(.+?)\s+to\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

CHANNEL_PATTERN = re.compile(
    r"Channel\s+(\d+)\s+runes?",
    re.IGNORECASE
)

READY_PATTERN = re.compile(
    r"Ready\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

EXHAUST_PATTERN = re.compile(
    r"(?:Exhaust|T:)\s*(.+?)(?:\.|$)",
    re.IGNORECASE
)

CREATE_TOKEN_PATTERN = re.compile(
    r"Create\s+a\s+(\d+)\[M\]\s+(.+?)\s+token",
    re.IGNORECASE
)

COST_REDUCTION_PATTERN = re.compile(
    r"(?:cost|Cost)\s+(?:is\s+)?reduced\s+by\s+(\d+)",
    re.IGNORECASE
)

ACCELERATE_PATTERN = re.compile(
    r"(?:Accelerate\.?\s+)?You\s+may\s+pay\s+(\d+)C\s+as\s+an\s+additional\s+cost\s+to\s+have\s+me\s+enter\s+ready",
    re.IGNORECASE
)

ASSAULT_PATTERN = re.compile(
    r"Assault\s+(\d+)",
    re.IGNORECASE
)

LEGION_PATTERN = re.compile(
    r"Legion\s*[:\-—]?\s*(.+?)(?:\.|$)",
    re.IGNORECASE
)

IF_THIS_KILLS_PATTERN = re.compile(
    r"If\s+this\s+kills\s+it,\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

WHEN_PLAY_PATTERN = re.compile(
    r"When\s+you\s+play\s+me,\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

WHEN_DISCARD_PATTERN = re.compile(
    r"When\s+you\s+discard\s+me,\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

WHEN_CONQUER_PATTERN = re.compile(
    r"When\s+I\s+conquer,\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

WHEN_HOLD_PATTERN = re.compile(
    r"When\s+I\s+hold,\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

AT_START_OF_PATTERN = re.compile(
    r"At\s+the\s+start\s+of\s+(?:your\s+)?(.+?),\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

AT_END_OF_PATTERN = re.compile(
    r"At\s+the\s+end\s+of\s+(?:your\s+)?(.+?),\s+(.+?)(?:\.|$)",
    re.IGNORECASE
)

ACTION_KEYWORD_PATTERN = re.compile(
    r"^Action\b",
    re.IGNORECASE
)

REACTION_KEYWORD_PATTERN = re.compile(
    r"^Reaction\b",
    re.IGNORECASE
)

GANKING_KEYWORD_PATTERN = re.compile(
    r"\bGanking\b",
    re.IGNORECASE
)

DEFLECT_KEYWORD_PATTERN = re.compile(
    r"\bDeflect\b",
    re.IGNORECASE
)

TEMPORARY_KEYWORD_PATTERN = re.compile(
    r"\bTemporary\b",
    re.IGNORECASE
)

DEATHKNELL_PATTERN = re.compile(
    r"Deathknell\s*[:\-—]?\s*(.+?)(?:\.|$)",
    re.IGNORECASE
)

TARGET_UNIT_AT_BATTLEFIELD = re.compile(
    r"(?:a\s+unit\s+at\s+a\s+battlefield|unit\s+at\s+a\s+battlefield)",
    re.IGNORECASE
)

TARGET_UNIT = re.compile(
    r"\ba\s+unit\b",
    re.IGNORECASE
)

TARGET_ALL_UNITS = re.compile(
    r"\ball\s+units\b",
    re.IGNORECASE
)
