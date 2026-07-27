# Тренування — Gym Tracker

Мобільний веб-додаток (PWA) для створення тренувальних програм, виконання їх у залі та відстеження прогресу.

## Огляд

- **Платформа:** Mobile-first PWA (працює як додаток на Android через браузер)
- **Мова інтерфейсу:** Українська
- **Користувачі:** Мультикористувацький (вибір профілю без авторизації)
- **Синхронізація:** Між пристроями через API (телефон + комп'ютер)

## Технічний стек

| Шар        | Технологія                                              |
| ---------- | ------------------------------------------------------- |
| Frontend   | Vue 3.5 + TypeScript 5.6 + Tailwind CSS 3.4 + Pinia 2.2 |
| Backend    | Node.js + Express 4.21 + TypeScript 5.6                 |
| База даних | PostgreSQL 16 (Docker локально, Render для деплою)      |
| PWA        | vite-plugin-pwa 0.20 (Service Worker, installable)      |
| Збірка     | Vite 5.4, tsx (dev server)                              |
| Монорепо   | npm workspaces (client + server)                        |

## Архітектура проєкту

```
gym-tracker/
├── package.json              ← workspaces root, scripts для dev/build/start
├── docker-compose.yml        ← PostgreSQL 16 на порту 5433
├── client/                   ← Vue 3 SPA (порт 5173 у dev)
│   ├── src/
│   │   ├── App.vue           ← Layout: header + nav + router-view (або UserSelect)
│   │   ├── main.ts           ← Pinia + Router + mount
│   │   ├── api/index.ts      ← fetch-based API клієнт (/api proxy)
│   │   ├── stores/user.ts    ← Pinia store з localStorage persistence
│   │   ├── router/index.ts   ← 6 маршрутів
│   │   ├── views/            ← 7 компонентів-сторінок
│   │   └── assets/main.css   ← Tailwind directives
│   ├── vite.config.ts        ← PWA plugin + /api proxy до localhost:3000
│   └── tailwind.config.js
└── server/                   ← Express API (порт 3000)
    ├── src/
    │   ├── index.ts          ← Express app + static serve у production
    │   ├── db/
    │   │   ├── pool.ts       ← pg Pool (DATABASE_URL || default)
    │   │   ├── migrate.ts    ← Reads and runs SQL migrations
    │   │   └── migrations/001_initial.sql
    │   └── routes/
    │       ├── users.ts
    │       ├── templates.ts
    │       ├── programs.ts
    │       └── measurements.ts
    └── tsconfig.json
```

### Production режим

У production сервер роздає збілджений клієнт як статику з `client/dist/` і обробляє SPA fallback. Один процес — один порт.

---

## Основні концепції

### Шаблон (Template)

Повторюваний скелет програми. Визначає структуру тренувального тижня: дні, вправи, підходи. Можна мати кілька шаблонів для різних цілей ("Набір маси", "Сушка", "Силова фаза").

### Тижнева програма (Weekly Program)

Конкретний план на тиждень, створений з шаблону або з нуля. Має реальні ваги/повторення. Це те, що береш у зал.

### Сесія (Session)

Один тренувальний день з програми. Під час сесії відмічаєш підходи, залишаєш коментарі.

### Замір (Body Measurement)

Запис параметрів тіла з датою: вага, обхвати (талія, груди, біцепс, стегно тощо).

---

## Функціональні можливості (реалізовано)

### 1. Вибір користувача

- Список профілів на головному екрані
- Створення нового профілю (тільки ім'я)
- Перемикання між профілями
- Збереження вибору в localStorage
- Logout (повернення до вибору профілю)

### 2. Управління шаблонами

- Список шаблонів користувача
- Створення / редагування / видалення шаблонів
- Структура: Дні → Вправи → Підходи
- Формат підходів: вага (кг) × кількість підходів × повторення (напр. `65 кг 4×10`)
- Підтримка розминкових підходів (індивідуальні: `40×15`, `50×12`)
- Кнопка "Створити програму з шаблону" (прямо з template detail)

### 3. Тижневі програми

- Список програм (поточна + історія), сортування за датою створення
- Створення з шаблону (копіює структуру, можна змінити ваги)
- Створення з нуля (порожня програма)
- Дедуплікація: якщо програма з такою назвою вже існує — повертається існуюча
- Редагування програми (edit mode у ProgramDetail):
  - Додавання / видалення днів, вправ, підходів
  - Зміна назви програми та днів
  - Коригування ваги, кількості підходів і повторень
  - Повна заміна структури через PUT з масивом `days`
- Перегляд днів з прогресом (скільки підходів виконано)
- Дата початку програми
- Видалення програми

### 4. Тренувальна сесія (GymSession)

- Вибір дня з поточної програми → перехід на `/programs/:id/session/:dayId`
- Список вправ з підходами / вагою / повтореннями
- Відмітка підходів як виконаних (tap to toggle, збереження на сервер)
- Текстовий коментар до кожної вправи (зберігається onBlur)
- Обов'язковий коментар до дня (фідбек після тренування)
- Кнопка "Завершити тренування" (зберігає day_note + completed_at)
- Мінімальний UI — тільки список і чекбокси

### 5. Історія тренувань

- При редагуванні програми автоматично завантажується історія:
  - **Exercise history** — коментарі до вправ з минулих тренувань (by day name + exercise name, last 3)
  - **Day history** — коментарі до днів з минулих тренувань (by day name, last 3)
- Показуються у контексті редагування (amber/blue фон)
- Cross-program: шукає по всіх програмах користувача, окрім поточної
- Перегляд виконаних підходів (done/total progress bar)

### 6. Заміри тіла

- Додавання запису: дата, вага тіла, довільні обхвати
- Типи замірів: Гомілка, Стегно, Сідниці, Талія, Груди, Плече/біцепс
- Перегляд історії замірів (сортовано за датою, нові зверху)
- Видалення записів
- Нотатки до запису

### 7. PWA

- Installable (можна додати на домашній екран Android)
- Service Worker для кешування статики (workbox, globPatterns: js/css/html/ico/png/svg)
- Standalone display mode (без адресного рядка)
- Portrait orientation, theme color: #2563eb

---

## Frontend — Маршрутизація

| Маршрут                        | Компонент          | Опис                |
| ------------------------------ | ------------------ | ------------------- |
| `/` (redirect)                 | —                  | → `/programs`       |
| `/programs`                    | Programs.vue       | Список програм      |
| `/programs/:id`                | ProgramDetail.vue  | Деталі + edit mode  |
| `/programs/:id/session/:dayId` | GymSession.vue     | Тренувальна сесія   |
| `/templates`                   | Templates.vue      | Список шаблонів     |
| `/templates/:id`               | TemplateDetail.vue | Редагування шаблону |
| `/measurements`                | Measurements.vue   | Заміри тіла         |

Навігація: sticky header + tabs (Програми / Шаблони / Заміри).  
Якщо `currentUser === null` — показується `UserSelect.vue` замість основного layout.

---

## Модель даних (PostgreSQL)

```
User
  id SERIAL PK, name VARCHAR(100), created_at TIMESTAMP

Template
  id SERIAL PK, user_id FK→users, name VARCHAR(200), created_at, updated_at
  └─ TemplateDays
       id SERIAL PK, template_id FK→templates (CASCADE), name VARCHAR(200), sort_order INT
       └─ TemplateExercises
            id SERIAL PK, template_day_id FK→template_days (CASCADE), name VARCHAR(200), sort_order INT
            └─ TemplateSets
                 id SERIAL PK, template_exercise_id FK→template_exercises (CASCADE),
                 weight DECIMAL(6,1), reps INT, count INT DEFAULT 1, sort_order INT

Program
  id SERIAL PK, user_id FK→users, template_id FK→templates (SET NULL),
  name VARCHAR(200), start_date DATE, created_at, updated_at
  └─ ProgramDays
       id SERIAL PK, program_id FK→programs (CASCADE), name VARCHAR(200),
       sort_order INT, day_note TEXT, completed_at TIMESTAMP
       └─ ProgramExercises
            id SERIAL PK, program_day_id FK→program_days (CASCADE),
            name VARCHAR(200), sort_order INT, note TEXT
            └─ ProgramSets
                 id SERIAL PK, program_exercise_id FK→program_exercises (CASCADE),
                 weight DECIMAL(6,1), reps INT, count INT DEFAULT 1,
                 done BOOLEAN DEFAULT FALSE, sort_order INT

BodyMeasurement
  id SERIAL PK, user_id FK→users, date DATE, weight DECIMAL(5,1),
  notes TEXT, created_at TIMESTAMP
  └─ MeasurementEntries
       id SERIAL PK, measurement_id FK→body_measurements (CASCADE),
       type VARCHAR(50), value DECIMAL(6,1)
```

Індекси: `templates(user_id)`, `programs(user_id)`, `body_measurements(user_id)`, `body_measurements(user_id, date)`.

---

## API

Base URL: `/api`

### Users

```
GET    /api/users              — список всіх користувачів
GET    /api/users/:id          — користувач по id
POST   /api/users              — створити {name}
PUT    /api/users/:id          — оновити {name}
DELETE /api/users/:id          — видалити (CASCADE)
```

### Templates

```
GET    /api/users/:userId/templates           — список шаблонів
GET    /api/users/:userId/templates/:id       — шаблон з повною структурою (days→exercises→sets)
POST   /api/users/:userId/templates           — створити {name, days?}
PUT    /api/users/:userId/templates/:id       — замінити {name?, days?}
DELETE /api/users/:userId/templates/:id       — видалити
```

### Programs

```
GET    /api/users/:userId/programs            — список програм
GET    /api/users/:userId/programs/:id        — програма з повною структурою
POST   /api/users/:userId/programs            — створити {name, start_date?, template_id?, days?}
PUT    /api/users/:userId/programs/:id        — оновити {name?, start_date?, days?}
DELETE /api/users/:userId/programs/:id        — видалити
```

### Program Session (in-gym actions)

```
PUT    /api/users/:userId/programs/:id/days/:dayId
         — оновити день {day_note?, completed_at?}
PUT    /api/users/:userId/programs/:id/days/:dayId/exercises/:exId
         — оновити вправу {note?}
PUT    /api/users/:userId/programs/:id/days/:dayId/exercises/:exId/sets/:setId
         — оновити підхід {done?, weight?, reps?, count?}
```

### Exercise & Day History

```
GET    /api/users/:userId/programs/:programId/exercise-history?dayName=&exerciseName=
         — коментарі до вправи з попередніх тренувань (last 3, cross-program)
GET    /api/users/:userId/programs/:programId/day-history?dayName=
         — коментарі до дня з попередніх тренувань (last 3, cross-program)
```

### Measurements

```
GET    /api/users/:userId/measurements        — список замірів (з entries)
GET    /api/users/:userId/measurements/:id    — замір по id
POST   /api/users/:userId/measurements        — створити {date?, weight?, notes?, entries?}
DELETE /api/users/:userId/measurements/:id    — видалити
```

### Health

```
GET    /api/health             — {status, db}
```

---

## Як запустити

```bash
# База даних
docker compose up -d

# Встановити залежності
npm install

# Міграції (перший раз)
npm run migrate

# Development (server: tsx watch, client: vite dev)
npm run dev:server   # порт 3000
npm run dev:client   # порт 5173, proxy /api → 3000

# Production build
npm run build        # client build + server tsc
npm run start        # node server/dist/index.js (serves client/dist as static)
```

Відкрити `http://localhost:5173` у dev або `http://localhost:3000` у production.

---

## Майбутній розвиток (не реалізовано)

### UX покращення

- Порівняння тижнів (попередня програма + фідбек при створенні нової)
- Drag & drop для зміни порядку вправ/днів
- Швидке введення підходів з парсингом (`65 4x10`)
- Підсумок тижня (загальний об'єм по м'язових групах)

### Аналітика та прогрес

- Графіки: динаміка ваги тіла, робочої ваги, тоннажу
- Персональні рекорди (автоматичне відстеження)
- Календар тренувань та стріки
- Графіки обхватів тіла

### Інфраструктура

- Авторизація (PIN або OAuth)
- Офлайн режим (IndexedDB + sync)
- Експорт / імпорт (JSON)
- PWA notifications (нагадування)
- CI/CD (GitHub Actions → Render)
