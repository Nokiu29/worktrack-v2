const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const ExcelJS = require('exceljs');
const path = require('path');

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

const SESSION_SECRET =
    process.env.SESSION_SECRET ||
    'worktrack-super-secret-change-me';

const dbPath =
    process.env.DB_PATH ||
    path.join(__dirname, 'worktrack.db');

const db =
    new Database(dbPath);


db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');


/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.json({
        limit: '2mb'
    })
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(
    session({
        secret:
            SESSION_SECRET,

        resave:
            false,

        saveUninitialized:
            false,

        cookie: {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
);


/* =========================================================
   DATABASE
========================================================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    norm REAL NOT NULL,
    rate REAL NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS report_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    batch_id INTEGER,
    work_type_id INTEGER NOT NULL,
    work_date TEXT NOT NULL,
    hours REAL NOT NULL,
    quantity REAL NOT NULL,
    productivity REAL NOT NULL,
    earnings REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (work_type_id) REFERENCES work_types(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`);


/* =========================================================
   MIGRATION
========================================================= */

/* reports.batch_id */

let reportColumns =
    db
        .prepare(`
            PRAGMA table_info(reports)
        `)
        .all()
        .map(
            column =>
                column.name
        );


if (
    !reportColumns.includes(
        'batch_id'
    )
) {

    try {

        db.prepare(`
            ALTER TABLE reports
            ADD COLUMN batch_id INTEGER
        `).run();

    } catch (error) {

        console.log(
            'Migration reports.batch_id:',
            error.message
        );

    }

}


/* work_types columns */

let workTypeColumns =
    db
        .prepare(`
            PRAGMA table_info(work_types)
        `)
        .all()
        .map(
            column =>
                column.name
        );


if (
    !workTypeColumns.includes(
        'norm'
    )
) {

    try {

        db.prepare(`
            ALTER TABLE work_types
            ADD COLUMN norm REAL
        `).run();

    } catch (error) {

        console.log(
            'Migration work_types.norm:',
            error.message
        );

    }

}


if (
    !workTypeColumns.includes(
        'rate'
    )
) {

    try {

        db.prepare(`
            ALTER TABLE work_types
            ADD COLUMN rate REAL
        `).run();

    } catch (error) {

        console.log(
            'Migration work_types.rate:',
            error.message
        );

    }

}


/* refresh columns */

workTypeColumns =
    db
        .prepare(`
            PRAGMA table_info(work_types)
        `)
        .all()
        .map(
            column =>
                column.name
        );


if (
    workTypeColumns.includes(
        'norm_per_hour'
    )
) {

    try {

        db.prepare(`
            UPDATE work_types
            SET norm = norm_per_hour
            WHERE norm IS NULL
        `).run();

    } catch (error) {

        console.log(
            'Migration norm_per_hour:',
            error.message
        );

    }

}


if (
    workTypeColumns.includes(
        'rate_per_hour'
    )
) {

    try {

        db.prepare(`
            UPDATE work_types
            SET rate = rate_per_hour
            WHERE rate IS NULL
        `).run();

    } catch (error) {

        console.log(
            'Migration rate_per_hour:',
            error.message
        );

    }

}


db.prepare(`
    UPDATE work_types
    SET norm = 1
    WHERE norm IS NULL
`).run();


db.prepare(`
    UPDATE work_types
    SET rate = 1
    WHERE rate IS NULL
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_batch_id
    ON reports(batch_id)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_user_id
    ON reports(user_id)
`).run();


db.prepare(`
    CREATE INDEX IF NOT EXISTS
    idx_reports_work_date
    ON reports(work_date)
`).run();


/* =========================================================
   HELPERS
========================================================= */

function settingExists(
    key
) {

    return Boolean(
        db
            .prepare(`
                SELECT 1
                FROM app_settings
                WHERE key = ?
            `)
            .get(key)
    );

}


function setSetting(
    key,
    value
) {

    db.prepare(`
        INSERT INTO app_settings (
            key,
            value
        )
        VALUES (?, ?)

        ON CONFLICT(key)
        DO UPDATE SET
            value = excluded.value
    `).run(
        key,
        String(value)
    );

}


function normalizeLogin(
    value
) {

    return String(
        value || ''
    )
        .trim()
        .toLowerCase();

}


function todayISO() {

    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            '0'
        );

    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            '0'
        );

    return `${year}-${month}-${day}`;

}


function isValidDate(
    value
) {

    return /^\d{4}-\d{2}-\d{2}$/.test(
        String(value || '')
    );

}


function calculateReport(
    hours,
    quantity,
    norm,
    rate
) {

    const safeHours =
        Number(hours);

    const safeQuantity =
        Number(quantity);

    const safeNorm =
        Number(norm);

    const safeRate =
        Number(rate);


    const productivity =
        safeHours > 0
            ? safeQuantity / safeHours
            : 0;


    let factor =
        1;


    if (
        safeNorm > 0 &&
        productivity < safeNorm
    ) {

        factor =
            Math.max(
                0.85,
                productivity / safeNorm
            );

    }


    const earnings =
        safeHours *
        safeRate *
        factor;


    return {
        productivity,
        factor,
        earnings
    };

}


/* =========================================================
   AUTH MIDDLEWARE
========================================================= */

function auth(
    req,
    res,
    next
) {

    if (
        !req.session.userId
    ) {

        return res.status(401).json({
            error:
                'Необхідно увійти в систему'
        });

    }


    next();

}


function adminOnly(
    req,
    res,
    next
) {

    if (
        req.session.role !== 'admin' &&
        req.session.role !== 'superadmin'
    ) {

        return res.status(403).json({
            error:
                'Недостатньо прав'
        });

    }


    next();

}


function superAdminOnly(
    req,
    res,
    next
) {

    if (
        req.session.role !== 'superadmin'
    ) {

        return res.status(403).json({
            error:
                'Потрібні права головного адміністратора'
        });

    }


    next();

}


/* =========================================================
   MAIN ADMIN
========================================================= */

const adminHash =
    bcrypt.hashSync(
        'admin123',
        10
    );


const existingAdmin =
    db
        .prepare(`
            SELECT id
            FROM users
            WHERE login = ?
        `)
        .get(
            'admin'
        );


if (
    !existingAdmin
) {

    db.prepare(`
        INSERT INTO users (
            name,
            login,
            password_hash,
            role,
            active
        )
        VALUES (
            ?,
            ?,
            ?,
            'superadmin',
            1
        )
    `).run(
        'Сергій Павлович',
        'admin',
        adminHash
    );

} else {

    db.prepare(`
        UPDATE users
        SET
            name = ?,
            password_hash = ?,
            role = 'superadmin',
            active = 1
        WHERE login = ?
    `).run(
        'Сергій Павлович',
        adminHash,
        'admin'
    );

}


/* =========================================================
   REMOVE OLD DEMO / EXTRA USERS ONCE
   Після цього сервер більше не створює ivan/alex.
========================================================= */

if (!settingExists('single_admin_cleanup_done')) {

    try {

        db.prepare(`
            DELETE FROM reports
            WHERE user_id IN (
                SELECT id
                FROM users
                WHERE login <> 'admin'
            )
        `).run();

        db.prepare(`
            DELETE FROM report_batches
            WHERE user_id IN (
                SELECT id
                FROM users
                WHERE login <> 'admin'
            )
        `).run();

        db.prepare(`
            DELETE FROM users
            WHERE login <> 'admin'
        `).run();

        setSetting(
            'single_admin_cleanup_done',
            '1'
        );

        console.log(
            'Старі акаунти видалено. Залишено тільки admin.'
        );

    } catch (error) {

        console.error(
            'SINGLE ADMIN CLEANUP ERROR:',
            error
        );

    }

}


/* =========================================================
   OLD DEMO WORK TYPES
========================================================= */

if (
    !settingExists(
        'old_default_work_types_removed'
    )
) {

    db.prepare(`
        UPDATE work_types
        SET active = 0
        WHERE name IN (?, ?, ?)
    `).run(
        'Накрутка пропеллеров',
        'Пайка',
        'S6'
    );


    setSetting(
        'old_default_work_types_removed',
        '1'
    );

}


/* =========================================================
   REGISTER
========================================================= */

app.post(
    '/api/register',
    (req, res) => {

        try {

            const name =
                String(
                    req.body.name || ''
                ).trim();


            const login =
                normalizeLogin(
                    req.body.login
                );


            const password =
                String(
                    req.body.password || ''
                );


            if (
                name.length < 2
            ) {

                return res.status(400).json({
                    error:
                        'Вкажіть коректне імʼя'
                });

            }


            if (
                !/^[a-zA-Z0-9_.-]{3,30}$/.test(
                    login
                )
            ) {

                return res.status(400).json({
                    error:
                        'Логін має містити 3–30 символів: латиниця, цифри, _ . -'
                });

            }


            if (
                password.length < 6
            ) {

                return res.status(400).json({
                    error:
                        'Пароль має містити щонайменше 6 символів'
                });

            }


            if (
                login === 'admin'
            ) {

                return res.status(400).json({
                    error:
                        'Логін admin зарезервований'
                });

            }


            const exists =
                db
                    .prepare(`
                        SELECT id
                        FROM users
                        WHERE login = ?
                    `)
                    .get(login);


            if (
                exists
            ) {

                return res.status(409).json({
                    error:
                        'Користувач з таким логіном уже існує'
                });

            }


            const passwordHash =
                bcrypt.hashSync(
                    password,
                    10
                );


            const result =
                db.prepare(`
                    INSERT INTO users (
                        name,
                        login,
                        password_hash,
                        role,
                        active
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        'employee',
                        1
                    )
                `).run(
                    name,
                    login,
                    passwordHash
                );


            const id =
                Number(
                    result.lastInsertRowid
                );


            req.session.userId =
                id;

            req.session.role =
                'employee';


            return res.json({

                ok: true,

                user: {
                    id,
                    name,
                    login,
                    role:
                        'employee'
                }

            });

        } catch (error) {

            console.error(
                'REGISTER ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося зареєструвати користувача'
            });

        }

    }
);


/* =========================================================
   LOGIN
========================================================= */

app.post(
    '/api/login',
    (req, res) => {

        try {

            const login =
                normalizeLogin(
                    req.body.login
                );


            const password =
                String(
                    req.body.password || ''
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            name,
                            login,
                            password_hash,
                            role,
                            active
                        FROM users
                        WHERE login = ?
                    `)
                    .get(login);


            if (
                !user
            ) {

                return res.status(401).json({
                    error:
                        'Невірний логін або пароль'
                });

            }


            if (
                !user.active
            ) {

                return res.status(403).json({
                    error:
                        'Цей обліковий запис деактивований'
                });

            }


            const passwordOk =
                bcrypt.compareSync(
                    password,
                    user.password_hash
                );


            if (
                !passwordOk
            ) {

                return res.status(401).json({
                    error:
                        'Невірний логін або пароль'
                });

            }


            req.session.userId =
                user.id;

            req.session.role =
                user.role;


            return res.json({

                ok: true,

                user: {

                    id:
                        user.id,

                    name:
                        user.name,

                    login:
                        user.login,

                    role:
                        user.role

                }

            });

        } catch (error) {

            console.error(
                'LOGIN ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося виконати вхід'
            });

        }

    }
);


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    '/api/logout',
    (req, res) => {

        req.session.destroy(
            () => {

                res.json({
                    ok: true
                });

            }
        );

    }
);


/* =========================================================
   ME
========================================================= */

app.get(
    '/api/me',
    (req, res) => {

        if (
            !req.session.userId
        ) {

            return res.json({
                user: null
            });

        }


        const user =
            db
                .prepare(`
                    SELECT
                        id,
                        name,
                        login,
                        role,
                        active
                    FROM users
                    WHERE id = ?
                `)
                .get(
                    req.session.userId
                );


        if (
            !user ||
            !user.active
        ) {

            req.session.destroy(
                () => {}
            );


            return res.json({
                user: null
            });

        }


        return res.json({
            user
        });

    }
);


/* =========================================================
   WORK TYPES
========================================================= */

app.get(
    '/api/work-types',
    auth,
    (req, res) => {

        try {

            const workTypes =
                db
                    .prepare(`
                        SELECT
                            id,
                            name,
                            norm,
                            rate,
                            active
                        FROM work_types
                        WHERE active = 1
                        ORDER BY
                            name COLLATE NOCASE ASC
                    `)
                    .all()
                    .map(
                        work => ({

                            id:
                                Number(
                                    work.id
                                ),

                            name:
                                work.name,

                            norm:
                                Number(
                                    work.norm || 0
                                ),

                            rate:
                                Number(
                                    work.rate || 0
                                ),

                            active:
                                Boolean(
                                    work.active
                                )

                        })
                    );


            return res.json({
                workTypes
            });

        } catch (error) {

            console.error(
                'WORK TYPES ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити види робіт'
            });

        }

    }
);


/* =========================================================
   SAVE REPORT
========================================================= */

app.post(
    '/api/reports',
    auth,
    (req, res) => {

        try {

            const workDate =
                String(
                    req.body.work_date || ''
                ).trim();


            const items =
                Array.isArray(
                    req.body.items
                )
                    ? req.body.items
                    : [];


            if (
                !isValidDate(
                    workDate
                )
            ) {

                return res.status(400).json({
                    error:
                        'Вкажіть коректну дату'
                });

            }


            if (
                !items.length
            ) {

                return res.status(400).json({
                    error:
                        'Додайте хоча б одне завдання'
                });

            }


            if (
                items.length > 50
            ) {

                return res.status(400).json({
                    error:
                        'В одному звіті можна додати не більше 50 завдань'
                });

            }


            const prepared =
                [];


            for (
                const item
                of items
            ) {

                const workTypeId =
                    Number(
                        item.work_type_id
                    );


                const hours =
                    Number(
                        item.hours
                    );


                const quantity =
                    Number(
                        item.quantity
                    );


                if (
                    !Number.isInteger(
                        workTypeId
                    ) ||
                    workTypeId <= 0
                ) {

                    return res.status(400).json({
                        error:
                            'Некоректний вид роботи'
                    });

                }


                if (
                    !Number.isFinite(
                        hours
                    ) ||
                    hours <= 0
                ) {

                    return res.status(400).json({
                        error:
                            'Кількість годин має бути більше 0'
                    });

                }


                if (
                    !Number.isFinite(
                        quantity
                    ) ||
                    quantity < 0
                ) {

                    return res.status(400).json({
                        error:
                            'Кількість не може бути відʼємною'
                    });

                }


                const workType =
                    db
                        .prepare(`
                            SELECT
                                id,
                                name,
                                norm,
                                rate
                            FROM work_types
                            WHERE id = ?
                              AND active = 1
                        `)
                        .get(
                            workTypeId
                        );


                if (
                    !workType
                ) {

                    return res.status(400).json({
                        error:
                            'Обраний вид роботи недоступний'
                    });

                }


                const calc =
                    calculateReport(
                        hours,
                        quantity,
                        workType.norm,
                        workType.rate
                    );


                prepared.push({

                    workType,

                    hours,

                    quantity,

                    productivity:
                        calc.productivity,

                    earnings:
                        calc.earnings

                });

            }


            const saveReport =
                db.transaction(
                    () => {

                        const batchResult =
                            db.prepare(`
                                INSERT INTO report_batches (
                                    user_id,
                                    work_date
                                )
                                VALUES (
                                    ?,
                                    ?
                                )
                            `).run(
                                req.session.userId,
                                workDate
                            );


                        const batchId =
                            Number(
                                batchResult.lastInsertRowid
                            );


                        const insert =
                            db.prepare(`
                                INSERT INTO reports (
                                    user_id,
                                    batch_id,
                                    work_type_id,
                                    work_date,
                                    hours,
                                    quantity,
                                    productivity,
                                    earnings
                                )
                                VALUES (
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?,
                                    ?
                                )
                            `);


                        for (
                            const item
                            of prepared
                        ) {

                            insert.run(
                                req.session.userId,
                                batchId,
                                item.workType.id,
                                workDate,
                                item.hours,
                                item.quantity,
                                item.productivity,
                                item.earnings
                            );

                        }


                        return batchId;

                    }
                );


            const batchId =
                saveReport();


            const totalHours =
                prepared.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.hours,
                    0
                );


            const totalEarnings =
                prepared.reduce(
                    (
                        sum,
                        item
                    ) =>
                        sum +
                        item.earnings,
                    0
                );


            return res.json({

                ok: true,

                batch_id:
                    batchId,

                task_count:
                    prepared.length,

                total_hours:
                    totalHours,

                total_earnings:
                    totalEarnings

            });

        } catch (error) {

            console.error(
                'SAVE REPORT ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося зберегти звіт'
            });

        }

    }
);


/* =========================================================
   MY REPORTS
========================================================= */

app.get(
    '/api/my/reports',
    auth,
    (req, res) => {

        try {

            const reports =
                db
                    .prepare(`
                        SELECT

                            r.id,
                            r.batch_id,
                            r.work_date,
                            r.hours,
                            r.quantity,
                            r.productivity,
                            r.earnings,

                            wt.name AS work_name,
                            wt.norm,
                            wt.rate

                        FROM reports r

                        INNER JOIN work_types wt
                            ON wt.id =
                            r.work_type_id

                        WHERE r.user_id = ?

                        ORDER BY
                            r.work_date DESC,
                            r.id DESC
                    `)
                    .all(
                        req.session.userId
                    );


            return res.json({

                reports:
                    reports.map(
                        row => ({

                            id:
                                row.id,

                            batch_id:
                                row.batch_id ||
                                null,

                            work_date:
                                row.work_date,

                            work_name:
                                row.work_name,

                            hours:
                                Number(
                                    row.hours
                                ),

                            quantity:
                                Number(
                                    row.quantity
                                ),

                            productivity:
                                Number(
                                    row.productivity
                                ),

                            norm:
                                Number(
                                    row.norm
                                ),

                            rate:
                                Number(
                                    row.rate
                                ),

                            earnings:
                                Number(
                                    row.earnings
                                )

                        })
                    )

            });

        } catch (error) {

            console.error(
                'MY REPORTS ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити ваші звіти'
            });

        }

    }
);


/* =========================================================
   MY SUMMARY
========================================================= */

app.get(
    '/api/my/summary',
    auth,
    (req, res) => {

        try {

            const stats =
                db
                    .prepare(`
                        SELECT

                            COALESCE(
                                SUM(
                                    r.earnings
                                ),
                                0
                            ) AS total_earnings,

                            COALESCE(
                                SUM(
                                    r.hours
                                ),
                                0
                            ) AS total_hours,

                            COUNT(
                                DISTINCT
                                COALESCE(
                                    r.batch_id,
                                    r.id
                                )
                            ) AS report_count

                        FROM reports r

                        WHERE
                            r.user_id = ?
                    `)
                    .get(
                        req.session.userId
                    );


            return res.json({

                total_earnings:
                    Number(
                        stats.total_earnings ||
                        0
                    ),

                total_hours:
                    Number(
                        stats.total_hours ||
                        0
                    ),

                report_count:
                    Number(
                        stats.report_count ||
                        0
                    )

            });

        } catch (error) {

            console.error(
                'MY SUMMARY ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити статистику'
            });

        }

    }
);


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

app.get(
    '/api/admin/dashboard',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const usersStats =
                db
                    .prepare(`
                        SELECT

                            COUNT(*) AS total_users,

                            SUM(
                                CASE
                                    WHEN active = 1
                                    THEN 1
                                    ELSE 0
                                END
                            ) AS active_users

                        FROM users
                    `)
                    .get();


            const reportStats =
                db
                    .prepare(`
                        SELECT

                            COUNT(
                                DISTINCT
                                COALESCE(
                                    r.batch_id,
                                    r.id
                                )
                            ) AS report_count,

                            COALESCE(
                                SUM(r.hours),
                                0
                            ) AS total_hours,

                            COALESCE(
                                SUM(r.earnings),
                                0
                            ) AS total_earnings

                        FROM reports r
                    `)
                    .get();


            const recentReports =
                db
                    .prepare(`
                        SELECT

                            r.id,
                            r.batch_id,
                            r.work_date,
                            r.hours,
                            r.quantity,
                            r.earnings,

                            u.name AS employee_name,
                            u.login,

                            wt.name AS work_name

                        FROM reports r

                        INNER JOIN users u
                            ON u.id =
                            r.user_id

                        INNER JOIN work_types wt
                            ON wt.id =
                            r.work_type_id

                        ORDER BY
                            r.work_date DESC,
                            r.id DESC

                        LIMIT 20
                    `)
                    .all();


            return res.json({

                users: {

                    total:
                        Number(
                            usersStats.total_users ||
                            0
                        ),

                    active:
                        Number(
                            usersStats.active_users ||
                            0
                        )

                },

                reports: {

                    count:
                        Number(
                            reportStats.report_count ||
                            0
                        ),

                    hours:
                        Number(
                            reportStats.total_hours ||
                            0
                        ),

                    earnings:
                        Number(
                            reportStats.total_earnings ||
                            0
                        )

                },

                recentReports:
                    recentReports.map(
                        row => ({

                            id:
                                row.id,

                            batch_id:
                                row.batch_id ||
                                null,

                            work_date:
                                row.work_date,

                            employee_name:
                                row.employee_name,

                            login:
                                row.login,

                            work_name:
                                row.work_name,

                            hours:
                                Number(
                                    row.hours
                                ),

                            quantity:
                                Number(
                                    row.quantity
                                ),

                            earnings:
                                Number(
                                    row.earnings
                                )

                        })
                    )

            });

        } catch (error) {

            console.error(
                'ADMIN DASHBOARD ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити панель адміністратора'
            });

        }

    }
);


/* =========================================================
   ADMIN USERS
========================================================= */

app.get(
    '/api/admin/users',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const users =
                db
                    .prepare(`
                        SELECT

                            id,
                            name,
                            login,
                            role,
                            active,
                            created_at

                        FROM users

                        ORDER BY

                            CASE
                                WHEN login = 'admin'
                                    THEN 0

                                WHEN role = 'superadmin'
                                    THEN 1

                                WHEN role = 'admin'
                                    THEN 2

                                ELSE 3
                            END,

                            name COLLATE NOCASE ASC
                    `)
                    .all();


            const result =
                users.map(
                    user => {

                        const stats =
                            db
                                .prepare(`
                                    SELECT

                                        COUNT(
                                            DISTINCT
                                            COALESCE(
                                                batch_id,
                                                id
                                            )
                                        ) AS report_count,

                                        COALESCE(
                                            SUM(hours),
                                            0
                                        ) AS total_hours,

                                        COALESCE(
                                            SUM(earnings),
                                            0
                                        ) AS total_earnings

                                    FROM reports

                                    WHERE user_id = ?
                                `)
                                .get(
                                    user.id
                                );


                        return {

                            id:
                                Number(
                                    user.id
                                ),

                            name:
                                user.name,

                            login:
                                user.login,

                            role:
                                user.role,

                            active:
                                Boolean(
                                    user.active
                                ),

                            created_at:
                                user.created_at,

                            report_count:
                                Number(
                                    stats.report_count ||
                                    0
                                ),

                            total_hours:
                                Number(
                                    stats.total_hours ||
                                    0
                                ),

                            total_earnings:
                                Number(
                                    stats.total_earnings ||
                                    0
                                )

                        };

                    }
                );


            return res.json({

                users:
                    result

            });

        } catch (error) {

            console.error(
                'ADMIN USERS ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити користувачів'
            });

        }

    }
);


/* =========================================================
   ALL REPORTS
========================================================= */

app.get(
    '/api/admin/report-batches',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const rows =
                db
                    .prepare(`
                        SELECT

                            r.id,
                            r.batch_id,
                            r.work_date,

                            r.hours,
                            r.quantity,
                            r.productivity,
                            r.earnings,

                            u.id AS employee_id,
                            u.name AS employee_name,
                            u.login,

                            wt.name AS work_name,
                            wt.norm,
                            wt.rate

                        FROM reports r

                        INNER JOIN users u
                            ON u.id =
                            r.user_id

                        INNER JOIN work_types wt
                            ON wt.id =
                            r.work_type_id

                        ORDER BY
                            r.work_date DESC,
                            u.name ASC,
                            r.id DESC
                    `)
                    .all();


            const grouped =
                new Map();


            for (
                const row
                of rows
            ) {

                const key =
                    row.batch_id
                        ? `batch-${row.batch_id}`
                        : `old-${row.id}`;


                if (
                    !grouped.has(key)
                ) {

                    grouped.set(
                        key,
                        {

                            key,

                            batch_id:
                                row.batch_id ||
                                null,

                            work_date:
                                row.work_date,

                            employee_id:
                                row.employee_id,

                            employee_name:
                                row.employee_name,

                            login:
                                row.login,

                            task_count:
                                0,

                            total_hours:
                                0,

                            total_quantity:
                                0,

                            total_earnings:
                                0,

                            tasks:
                                []

                        }
                    );

                }


                const report =
                    grouped.get(
                        key
                    );


                report.task_count += 1;


                report.total_hours +=
                    Number(
                        row.hours
                    );


                report.total_quantity +=
                    Number(
                        row.quantity
                    );


                report.total_earnings +=
                    Number(
                        row.earnings
                    );


                const productivity =
                    Number(
                        row.productivity
                    );


                const norm =
                    Number(
                        row.norm
                    );


                const percent =
                    norm > 0
                        ? (
                            productivity /
                            norm
                        ) * 100
                        : 0;


                report.tasks.push({

                    id:
                        row.id,

                    work_name:
                        row.work_name,

                    hours:
                        Number(
                            row.hours
                        ),

                    quantity:
                        Number(
                            row.quantity
                        ),

                    productivity,

                    norm,

                    percent,

                    rate:
                        Number(
                            row.rate
                        ),

                    earnings:
                        Number(
                            row.earnings
                        )

                });

            }


            return res.json({

                reports:
                    Array.from(
                        grouped.values()
                    )

            });

        } catch (error) {

            console.error(
                'REPORT BATCHES ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося завантажити звіти'
            });

        }

    }
);


/* =========================================================
   PROMOTE USER
========================================================= */

app.post(
    '/api/superadmin/users/:id/promote',
    auth,
    superAdminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            login,
                            role
                        FROM users
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !user
            ) {

                return res.status(404).json({
                    error:
                        'Користувача не знайдено'
                });

            }


            if (
                user.login ===
                'admin'
            ) {

                return res.status(400).json({
                    error:
                        'Головного адміністратора не можна змінити'
                });

            }


            db.prepare(`
                UPDATE users
                SET role = 'admin'
                WHERE id = ?
            `).run(id);


            return res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                'PROMOTE ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося надати права адміністратора'
            });

        }

    }
);


/* =========================================================
   DEMOTE USER
========================================================= */

app.post(
    '/api/superadmin/users/:id/demote',
    auth,
    superAdminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            login,
                            role
                        FROM users
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !user
            ) {

                return res.status(404).json({
                    error:
                        'Користувача не знайдено'
                });

            }


            if (
                user.login ===
                'admin'
            ) {

                return res.status(400).json({
                    error:
                        'Головного адміністратора не можна змінити'
                });

            }


            db.prepare(`
                UPDATE users
                SET role = 'employee'
                WHERE id = ?
            `).run(id);


            return res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                'DEMOTE ERROR:',
                error
            );


            return res.status(500).json({
                error:
                    'Не вдалося забрати права адміністратора'
            });

        }

    }
);


/* =========================================================
   DEACTIVATE USER
========================================================= */

app.delete(
    '/api/admin/users/:id',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            login,
                            role,
                            active
                        FROM users
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !user
            ) {

                return res.status(404).json({
                    error:
                        'Користувача не знайдено'
                });

            }


            if (
                user.login ===
                'admin'
            ) {

                return res.status(400).json({
                    error:
                        'Головного адміністратора не можна деактивувати'
                });

            }


            /*
               Обычный администратор не может
               деактивировать другого администратора.
            */

            if (
                user.role ===
                'admin' &&
                req.session.role !==
                'superadmin'
            ) {

                return res.status(403).json({
                    error:
                        'Тільки головний адміністратор може деактивувати адміністратора'
                });

            }


            db.prepare(`
                UPDATE users
                SET active = 0
                WHERE id = ?
            `).run(id);


            return res.json({

                ok: true,

                message:
                    'Працівника деактивовано'

            });

        } catch (error) {

            console.error(
                'DEACTIVATE USER ERROR:',
                error
            );


            return res.status(500).json({

                error:
                    'Не вдалося деактивувати користувача'

            });

        }

    }
);


/* =========================================================
   ACTIVATE USER
========================================================= */

app.post(
    '/api/superadmin/users/:id/activate',
    auth,
    superAdminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            login,
                            role,
                            active
                        FROM users
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !user
            ) {

                return res.status(404).json({

                    error:
                        'Користувача не знайдено'

                });

            }


            if (
                user.login ===
                'admin'
            ) {

                return res.status(400).json({

                    error:
                        'Головного адміністратора не потрібно активувати'

                });

            }


            db.prepare(`
                UPDATE users
                SET active = 1
                WHERE id = ?
            `).run(id);


            return res.json({

                ok:
                    true,

                message:
                    'Акаунт працівника активовано'

            });

        } catch (error) {

            console.error(
                'ACTIVATE USER ERROR:',
                error
            );


            return res.status(500).json({

                error:
                    'Не вдалося активувати акаунт'

            });

        }

    }
);


/* =========================================================
   DELETE USER COMPLETELY
   Только после деактивации
========================================================= */

app.delete(
    '/api/superadmin/users/:id/delete',
    auth,
    superAdminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const user =
                db
                    .prepare(`
                        SELECT
                            id,
                            login,
                            role,
                            name,
                            active
                        FROM users
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !user
            ) {

                return res.status(404).json({

                    error:
                        'Користувача не знайдено'

                });

            }


            if (
                user.login ===
                'admin'
            ) {

                return res.status(400).json({

                    error:
                        'Головного адміністратора не можна видалити'

                });

            }


            /*
               Удалять можно только
               неактивного пользователя.
            */

            if (
                user.active
            ) {

                return res.status(400).json({

                    error:
                        'Спочатку деактивуйте працівника, після цього його можна видалити'

                });

            }


            const deleteUser =
                db.transaction(
                    () => {

                        /*
                           Сначала удаляем отчёты.
                        */

                        db.prepare(`
                            DELETE FROM reports
                            WHERE user_id = ?
                        `).run(id);


                        /*
                           Потом группы отчётов.
                        */

                        db.prepare(`
                            DELETE FROM report_batches
                            WHERE user_id = ?
                        `).run(id);


                        /*
                           И только потом аккаунт.
                        */

                        db.prepare(`
                            DELETE FROM users
                            WHERE id = ?
                        `).run(id);

                    }
                );


            deleteUser();


            return res.json({

                ok:
                    true,

                message:
                    'Акаунт працівника повністю видалено'

            });

        } catch (error) {

            console.error(
                'DELETE USER ERROR:',
                error
            );


            return res.status(500).json({

                error:
                    'Не вдалося повністю видалити акаунт'

            });

        }

    }
);


/* =========================================================
   ADD WORK TYPE
========================================================= */

app.post(
    '/api/admin/work-types',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const name =
                String(
                    req.body.name ||
                    ''
                ).trim();


            const norm =
                Number(
                    req.body.norm
                );


            const rate =
                Number(
                    req.body.rate
                );


            if (
                name.length < 2
            ) {

                return res.status(400).json({

                    error:
                        'Вкажіть назву роботи'

                });

            }


            if (
                !Number.isFinite(norm) ||
                norm <= 0 ||
                !Number.isInteger(norm)
            ) {

                return res.status(400).json({

                    error:
                        'Норма має бути цілим числом більше 0'

                });

            }


            if (
                !Number.isFinite(rate) ||
                rate <= 0
            ) {

                return res.status(400).json({

                    error:
                        'Ставка має бути числом більше 0'

                });

            }


            const duplicate =
                db
                    .prepare(`
                        SELECT id
                        FROM work_types
                        WHERE name = ?
                          AND active = 1
                    `)
                    .get(name);


            if (
                duplicate
            ) {

                return res.status(409).json({

                    error:
                        'Такий вид роботи вже існує'

                });

            }


            const columns =
                db
                    .prepare(`
                        PRAGMA table_info(work_types)
                    `)
                    .all();


            const names =
                columns.map(
                    column =>
                        column.name
                );


            let result;


            /*
               Поддержка старой БД,
               где есть обязательные
               norm_per_hour и rate_per_hour.
            */

            if (
                names.includes(
                    'norm_per_hour'
                ) &&
                names.includes(
                    'rate_per_hour'
                )
            ) {

                result =
                    db.prepare(`
                        INSERT INTO work_types (
                            name,
                            norm,
                            rate,
                            norm_per_hour,
                            rate_per_hour,
                            active
                        )
                        VALUES (
                            ?,
                            ?,
                            ?,
                            ?,
                            ?,
                            1
                        )
                    `).run(
                        name,
                        norm,
                        rate,
                        norm,
                        rate
                    );

            } else {

                result =
                    db.prepare(`
                        INSERT INTO work_types (
                            name,
                            norm,
                            rate,
                            active
                        )
                        VALUES (
                            ?,
                            ?,
                            ?,
                            1
                        )
                    `).run(
                        name,
                        norm,
                        rate
                    );

            }


            return res.json({

                ok:
                    true,

                workType: {

                    id:
                        Number(
                            result.lastInsertRowid
                        ),

                    name,

                    norm,

                    rate,

                    active:
                        true

                }

            });

        } catch (error) {

            console.error(
                'ADD WORK TYPE ERROR:',
                error
            );


            return res.status(500).json({

                error:
                    'Не вдалося додати роботу'

            });

        }

    }
);


/* =========================================================
   DELETE WORK TYPE
========================================================= */

app.delete(
    '/api/admin/work-types/:id',
    auth,
    adminOnly,
    (req, res) => {

        try {

            const id =
                Number(
                    req.params.id
                );


            const work =
                db
                    .prepare(`
                        SELECT id
                        FROM work_types
                        WHERE id = ?
                    `)
                    .get(id);


            if (
                !work
            ) {

                return res.status(404).json({

                    error:
                        'Вид роботи не знайдено'

                });

            }


            /*
               Мягкое удаление.
            */

            db.prepare(`
                UPDATE work_types
                SET active = 0
                WHERE id = ?
            `).run(id);


            return res.json({
                ok: true
            });

        } catch (error) {

            console.error(
                'DELETE WORK ERROR:',
                error
            );


            return res.status(500).json({

                error:
                    'Не вдалося видалити роботу'

            });

        }

    }
);


/* =========================================================
   EXCEL
========================================================= */

app.get(
    '/api/admin/export-excel',
    auth,
    adminOnly,
    async (req, res) => {

        try {

            const workbook =
                new ExcelJS.Workbook();


            workbook.creator =
                'WorkTrack';


            workbook.created =
                new Date();


            /* ===============================================
               ЗАРОБІТОК
            =============================================== */

            const incomeSheet =
                workbook.addWorksheet(
                    'Заробіток'
                );


            incomeSheet.columns = [

                {
                    header:
                        'Імʼя',
                    key:
                        'name',
                    width:
                        25
                },

                {
                    header:
                        'Логін',
                    key:
                        'login',
                    width:
                        18
                },

                {
                    header:
                        'Роль',
                    key:
                        'role',
                    width:
                        22
                },

                {
                    header:
                        'Здано звітів',
                    key:
                        'report_count',
                    width:
                        16
                },

                {
                    header:
                        'Відпрацьовано',
                    key:
                        'hours',
                    width:
                        18
                },

                {
                    header:
                        'Заробіток',
                    key:
                        'earnings',
                    width:
                        18
                },

                {
                    header:
                        'Статус',
                    key:
                        'active',
                    width:
                        14
                }

            ];


            const users =
                db
                    .prepare(`
                        SELECT
                            id,
                            name,
                            login,
                            role,
                            active
                        FROM users
                        ORDER BY
                            name COLLATE NOCASE ASC
                    `)
                    .all();


            for (
                const user
                of users
            ) {

                const stats =
                    db
                        .prepare(`
                            SELECT

                                COUNT(
                                    DISTINCT
                                    COALESCE(
                                        batch_id,
                                        id
                                    )
                                ) AS report_count,

                                COALESCE(
                                    SUM(hours),
                                    0
                                ) AS hours,

                                COALESCE(
                                    SUM(earnings),
                                    0
                                ) AS earnings

                            FROM reports

                            WHERE user_id = ?
                        `)
                        .get(
                            user.id
                        );


                incomeSheet.addRow({

                    name:
                        user.name,

                    login:
                        user.login,

                    role:
                        user.role,

                    report_count:
                        Number(
                            stats.report_count ||
                            0
                        ),

                    hours:
                        Number(
                            stats.hours ||
                            0
                        ),

                    earnings:
                        Number(
                            stats.earnings ||
                            0
                        ),

                    active:
                        user.active
                            ? 'Активний'
                            : 'Неактивний'

                });

            }


            incomeSheet.getRow(
                1
            ).font = {
                bold:
                    true
            };


            incomeSheet
                .getColumn(
                    'hours'
                )
                .numFmt =
                '0.00';


            incomeSheet
                .getColumn(
                    'earnings'
                )
                .numFmt =
                '#,##0.00';


            /* ===============================================
               ЗВІТИ
            =============================================== */

            const reportsSheet =
                workbook.addWorksheet(
                    'Звіти'
                );


            reportsSheet.columns = [

                {
                    header:
                        'Дата',
                    key:
                        'work_date',
                    width:
                        14
                },

                {
                    header:
                        'Працівник',
                    key:
                        'employee',
                    width:
                        25
                },

                {
                    header:
                        'Логін',
                    key:
                        'login',
                    width:
                        18
                },

                {
                    header:
                        'Завдання',
                    key:
                        'work_name',
                    width:
                        30
                },

                {
                    header:
                        'Години',
                    key:
                        'hours',
                    width:
                        12
                },

                {
                    header:
                        'Кількість',
                    key:
                        'quantity',
                    width:
                        14
                },

                {
                    header:
                        'Виробіток',
                    key:
                        'productivity',
                    width:
                        15
                },

                {
                    header:
                        'Норма',
                    key:
                        'norm',
                    width:
                        12
                },

                {
                    header:
                        'Виконання, %',
                    key:
                        'percent',
                    width:
                        16
                },

                {
                    header:
                        'Ставка',
                    key:
                        'rate',
                    width:
                        14
                },

                {
                    header:
                        'Заробіток',
                    key:
                        'earnings',
                    width:
                        16
                },

                {
                    header:
                        'Batch ID',
                    key:
                        'batch_id',
                    width:
                        12
                }

            ];


            const reportRows =
                db
                    .prepare(`
                        SELECT

                            r.batch_id,
                            r.work_date,
                            r.hours,
                            r.quantity,
                            r.productivity,
                            r.earnings,

                            u.name AS employee_name,
                            u.login,

                            wt.name AS work_name,
                            wt.norm,
                            wt.rate

                        FROM reports r

                        INNER JOIN users u
                            ON u.id =
                            r.user_id

                        INNER JOIN work_types wt
                            ON wt.id =
                            r.work_type_id

                        ORDER BY
                            r.work_date DESC,
                            u.name ASC,
                            r.id DESC
                    `)
                    .all();


            for (
                const row
                of reportRows
            ) {

                const productivity =
                    Number(
                        row.productivity ||
                        0
                    );


                const norm =
                    Number(
                        row.norm ||
                        0
                    );


                const percent =
                    norm > 0
                        ? (
                            productivity /
                            norm
                        ) *
                        100
                        : 0;


                reportsSheet.addRow({

                    work_date:
                        row.work_date,

                    employee:
                        row.employee_name,

                    login:
                        row.login,

                    work_name:
                        row.work_name,

                    hours:
                        Number(
                            row.hours ||
                            0
                        ),

                    quantity:
                        Number(
                            row.quantity ||
                            0
                        ),

                    productivity,

                    norm,

                    percent,

                    rate:
                        Number(
                            row.rate ||
                            0
                        ),

                    earnings:
                        Number(
                            row.earnings ||
                            0
                        ),

                    batch_id:
                        row.batch_id ||
                        ''

                });

            }


            reportsSheet.getRow(
                1
            ).font = {
                bold:
                    true
            };


            reportsSheet
                .getColumn(
                    'hours'
                )
                .numFmt =
                '0.00';


            reportsSheet
                .getColumn(
                    'quantity'
                )
                .numFmt =
                '0.00';


            reportsSheet
                .getColumn(
                    'productivity'
                )
                .numFmt =
                '0.00';


            reportsSheet
                .getColumn(
                    'percent'
                )
                .numFmt =
                '0.00';


            reportsSheet
                .getColumn(
                    'rate'
                )
                .numFmt =
                '#,##0.00';


            reportsSheet
                .getColumn(
                    'earnings'
                )
                .numFmt =
                '#,##0.00';


            /* ===============================================
               ВИДИ РОБІТ
            =============================================== */

            const workSheet =
                workbook.addWorksheet(
                    'Види робіт'
                );


            workSheet.columns = [

                {
                    header:
                        'ID',
                    key:
                        'id',
                    width:
                        10
                },

                {
                    header:
                        'Назва',
                    key:
                        'name',
                    width:
                        30
                },

                {
                    header:
                        'Норма / год',
                    key:
                        'norm',
                    width:
                        16
                },

                {
                    header:
                        'Ставка / год',
                    key:
                        'rate',
                    width:
                        16
                },

                {
                    header:
                        'Статус',
                    key:
                        'active',
                    width:
                        14
                }

            ];


            const allWorkTypes =
                db
                    .prepare(`
                        SELECT
                            id,
                            name,
                            norm,
                            rate,
                            active
                        FROM work_types
                        ORDER BY
                            name COLLATE NOCASE ASC
                    `)
                    .all();


            for (
                const work
                of allWorkTypes
            ) {

                workSheet.addRow({

                    id:
                        work.id,

                    name:
                        work.name,

                    norm:
                        Number(
                            work.norm ||
                            0
                        ),

                    rate:
                        Number(
                            work.rate ||
                            0
                        ),

                    active:
                        work.active
                            ? 'Активне'
                            : 'Неактивне'

                });

            }


            workSheet.getRow(
                1
            ).font = {
                bold:
                    true
            };


            workSheet
                .getColumn(
                    'norm'
                )
                .numFmt =
                '0';


            workSheet
                .getColumn(
                    'rate'
                )
                .numFmt =
                '#,##0.00';


            const fileName =
                `WorkTrack-${todayISO()}.xlsx`;


            res.setHeader(
                'Content-Type',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );


            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${fileName}"`
            );


            await workbook.xlsx.write(
                res
            );


            res.end();

        } catch (error) {

            console.error(
                'EXCEL ERROR:',
                error
            );


            if (
                !res.headersSent
            ) {

                res.status(500).json({

                    error:
                        'Не вдалося створити Excel-файл'

                });

            }

        }

    }
);


/* =========================================================
   STATIC
========================================================= */

app.use(
    express.static(
        path.join(
            __dirname,
            'public'
        )
    )
);


app.get(
    '*',
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                'public',
                'index.html'
            )
        );

    }
);


/* =========================================================
   START
========================================================= */

app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log('');
        console.log(
            '========================================'
        );
        console.log(
            ' WorkTrack запущено'
        );
        console.log(
            ` Порт: ${PORT}`
        );
        console.log(
            ` http://localhost:${PORT}`
        );
        console.log(
            '========================================'
        );
        console.log('');
        console.log(
            'Адміністратор: admin'
        );
        console.log(
            'Пароль: admin123'
        );
        console.log(
            'Імʼя: Сергій Павлович'
        );
        console.log('');

    }
);


/* =========================================================
   SHUTDOWN
========================================================= */

function shutdown() {

    try {

        db.close();

    } catch (_) {}


    process.exit(0);

}


process.on(
    'SIGINT',
    shutdown
);

process.on(
    'SIGTERM',
    shutdown
);