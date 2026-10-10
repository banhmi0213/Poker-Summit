-- スタンダードプランの継続による優良店バッジを廃止。
update public.plans
set description = replace(description, E'\n1か月以上の継続で優良店バッジを付与', ''),
    badge_after_days = null
where tier = 2;
