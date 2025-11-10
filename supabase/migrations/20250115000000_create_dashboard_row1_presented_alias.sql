create or replace view public.dashboard_row1_presented_alias as

select

  v.*,

  v.rating_avg as reviews_average

from public.dashboard_row1_presented v;






