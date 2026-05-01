# 01_INPUT_SCHEMA — Входные данные для Большого исследования

---

## Обязательные поля

```json
{
  "name": "Имя клиента",
  "gender": "male|female",
  "birth_date": "DD.MM.YYYY",
  "calculation": {
    "soul": 6,
    "path": 5,
    "expression": 2,
    "direction": 8,
    "result": 4,
    "soul_composite": "24/6",
    "path_composite": "32/5",
    "expression_composite": null,
    "direction_composite": "35/8",
    "result_composite": "22/4",
    "financial_code": "6-5-8-4",
    "personal_year": 3,
    "personal_month": 7,
    "matrix": {
      "counts": { "1": 0, "2": 2, "3": 1, "4": 0, "5": 2, "6": 1, "7": 0, "8": 1, "9": 2 }
    },
    "tension_score": 7
  }
}
```

## Опциональные поля

```json
{
  "primary_request": "Свободный запрос клиента",
  "age": 40,
  "myth_answers": {
    "q1": "Ответ на вопрос о текущем состоянии",
    "q2": "Ответ-образ",
    "q3": "Момент живости",
    "q4": "Недостающее качество"
  }
}
```

## Правила использования

1. Все числа берутся ТОЛЬКО из `calculation`. Не пересчитывать.
2. Если `primary_request` задан — привязать к нему секции IV, XIII, XVII.
3. Если `myth_answers` есть — использовать в секции XVIII (Живое слово) как эмоциональный контекст.
4. `tension_score` выше 6 → акцентировать секцию XIII (Главный конфликт).
5. `personal_year` → секция XVI обязательна.
