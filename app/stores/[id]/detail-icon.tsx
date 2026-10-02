type IconName = "clock" | "pin" | "phone" | "train" | "menu" | "calendar" | "ticket" | "notice" | "briefcase" | "trophy";
const paths: Record<IconName, string> = {
  clock: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  phone: "M8 3H4v4c0 7 6 13 13 13h4v-4l-5-2-2 2c-3-1-5-3-6-6l2-2-2-5Z",
  train: "M6 17V5c0-3 12-3 12 0v12H6Z M6 11h12 M9 17l-3 4 M15 17l3 4 M9 14h.01 M15 14h.01",
  menu: "M3 2v6a3 3 0 0 0 6 0V2 M6 2v20 M16 2c-3 4-4 8-4 11h6 M18 2v20",
  calendar: "M3 5h18v16H3V5Z M7 2v6 M17 2v6 M3 10h18 M7 14h2 M13 14h2 M7 17h2",
  ticket: "M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4V5Z M14 8v2 M14 12v2 M14 16v1",
  notice: "M6 3h9l3 3v15H6V3Z M14 3v5h4 M9 12h6 M9 16h6",
  briefcase: "M3 7h18v13H3V7Z M8 7V3h8v4 M3 12h18 M10 12v3h4v-3",
  trophy: "M7 3h10v7a5 5 0 0 1-10 0V3Z M7 5H3v3a4 4 0 0 0 5 4 M17 5h4v3a4 4 0 0 1-5 4 M12 15v6 M8 21h8",
};
export function DetailIcon({name}: {name: IconName}) {
  return <svg className="sd-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
