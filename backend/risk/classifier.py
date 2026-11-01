"""Risk severity is independent of recognition confidence."""
RISK_BY_CATEGORY = {
    "CREDENTIAL_OR_SECRET": "CRITICAL",
    "BANK_ACCOUNT_CANDIDATE": "HIGH", "IFSC": "HIGH",
    "AADHAAR_CANDIDATE": "HIGH", "PAN_CANDIDATE": "HIGH", "UPI_ID": "HIGH",
    "EMAIL": "MEDIUM", "INDIAN_MOBILE": "MEDIUM",
    "PERSON_NAME": "CONTEXT_DEPENDENT", "ADDRESS": "CONTEXT_DEPENDENT",
    "DATE_OF_BIRTH": "CONTEXT_DEPENDENT",
}
def classify_risk(category: str) -> str:
    return RISK_BY_CATEGORY.get(category, "CONTEXT_DEPENDENT")

