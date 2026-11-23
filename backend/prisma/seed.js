// Стартові дані для РОЗРОБКИ: тестові користувачі і теги.
// Запуск: npm run db:seed. Скрипт повторюваний: повторний запуск не створює дублікатів.
const bcrypt = require('bcryptjs');
const env = require('../src/config/env');
const db = require('../src/config/db');

const TEST_PASSWORD = 'password123';

// Ті самі акаунти, що в мок-API (frontend/mock), щоб frontend працював однаково з обома
const USERS = [
  { username: 'admin', name: 'Анастасія Бондар', role: 'ADMIN' },
  { username: 'valeria', name: 'Валерія Мельник', role: 'MODERATOR' },
  { username: 'oleksandr', name: 'Олександр Коваль', role: 'USER' },
  { username: 'ivan', name: 'Іван Шевченко', role: 'USER' },
  { username: 'anna', name: 'Анна Ткачук', role: 'USER' },
  { username: 'vlad', name: 'Влад Кравченко', role: 'USER' },
  { username: 'myroslav', name: 'Мирослав Лисенко', role: 'USER' },
  { username: 'dmytro', name: 'Дмитро Поліщук', role: 'USER' },
  { username: 'banned_user', name: 'Заблокований Користувач', role: 'USER', isActive: false },
  { username: 'newbie', name: 'Новачок Без Аватара', role: 'USER' },
  // Акаунт лише з Google (TASK-066): пароля немає, увійти можна тільки через Google
  { username: 'google_user', name: 'Гугл Користувач', role: 'USER', googleId: 'seed-google-1' },
  // Звичайний акаунт, пов'язаний з Google: працюють обидва способи входу
  {
    username: 'linked',
    name: 'Пов’язаний Акаунт',
    role: 'USER',
    googleId: 'seed-google-2',
    password: true,
  },
];

// Теги завжди в нижньому регістрі (D-09), довжина до 30 символів
const TAGS = [
  'море', 'захід', 'небо', 'гори', 'подорожі', 'природа', 'ліс', 'туман', 'ранок', 'озеро',
  'відображення', 'вода', 'тиша', 'пустеля', 'дюни', 'місто', 'ніч', 'архітектура', 'осінь',
  'пагорби', 'сніг', 'зима', 'трекінг', 'висота',
];

async function seedUsers() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const { username, name, role, isActive = true, googleId = null, password } of USERS) {
    const email = `${username}@example.com`;
    // Без googleId пароль є завжди; з googleId - лише якщо password: true
    const hash = !googleId || password ? passwordHash : null;
    await db.user.upsert({
      where: { email },
      update: { name, role, isActive, googleId, passwordHash: hash },
      create: { username, email, name, role, isActive, googleId, passwordHash: hash },
    });
  }
  return USERS.length;
}

async function seedTags() {
  const { count } = await db.tag.createMany({
    data: TAGS.map((name) => ({ name })),
    skipDuplicates: true,
  });
  return count;
}

async function main() {
  if (env.isProduction) {
    throw new Error('Seed призначений лише для розробки, у production його не запускаємо');
  }

  const users = await seedUsers();
  const newTags = await seedTags();
  console.log(
    `Seed готовий: користувачів ${users} (пароль ${TEST_PASSWORD}, у google_user пароля немає), нових тегів ${newTags}`,
  );
}

main()
  .catch((err) => {
    console.error('Seed не виконано:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
