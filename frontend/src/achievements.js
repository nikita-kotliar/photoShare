// Досягнення (TASK-070). Коди збігаються з бекендом; тут назви і підказки для інтерфейсу
export const ACHIEVEMENTS = [
  { code: 'FIRST_PHOTO', title: 'Перша світлина', hint: 'Опублікуйте першу світлину' },
  { code: 'TEN_PHOTOS', title: '10 публікацій', hint: 'Опублікуйте 10 світлин' },
  { code: 'COMMENTATOR', title: 'Коментатор', hint: 'Залиште 20 коментарів' },
  { code: 'CRITIC', title: 'Критик', hint: 'Поставте 50 оцінок' },
  {
    code: 'FAVORITE',
    title: 'Улюбленець',
    hint: 'Отримайте середній рейтинг 4.5 або вище хоча б від 5 оцінок',
  },
];

export function achievementTitle(code) {
  return ACHIEVEMENTS.find((a) => a.code === code)?.title ?? 'Нове досягнення';
}
