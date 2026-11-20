# API: FastAPI backend (Vercel Python functions). Owner: Hari.

Stage 4 (done): the alert logic and its tests. Stage 5 adds the FastAPI endpoints.

| File | What |
|---|---|
| `alert_logic.py` | Temperature correction + all alert rules (spec section 4). Pure Python, no database. |
| `alert_config.py` | Every threshold in one place. Tune here. |
| `tests/test_alert_logic.py` | 23 pytest tests, incl. the 4 required ones (marked `required_` in the name) |

## Run the tests
Needs Python 3.10+.
```bash
cd api
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
pytest -v
```
All must pass before changing anything that uses the alert logic (CLAUDE.md rule).

## The rules in one screen
Everything compares **corrected** pressure (pressure the tyre would have at 20 °C), so a tyre
heating up or cooling down never looks like a leak.

| Alert | Fires when | Severity |
|---|---|---|
| critical_pressure | corrected < 80% of recommended | critical |
| low_pressure | corrected < 90% for 3 readings in a row (not raised if critical already is) | warning |
| slow_leak | regression slope over last 30 min < −13.8 kPa/h (≈ −2 psi/h); needs ≥ 10 readings spanning ≥ 10 min | warning, critical below −41 kPa/h |
| high_temp | temp > tyre's max_temp_c (default 85 °C) | warning |
| sensor_offline | tyre silent ≥ 10 min while its device is still sending | warning |

Same type for the same tyre is not raised again within 30 minutes.
