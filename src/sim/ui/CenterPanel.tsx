import { Table, type TableProps } from './Table';
import { centerLayout } from './layouts';

/** The proposition (center) bets: any 7, hardways, horn, etc. Same props as Table minus the layout and puck. */
export function CenterPanel(
  props: Omit<TableProps, 'layout' | 'point'> & { point?: TableProps['point'] },
) {
  return (
    <Table
      {...props}
      layout={centerLayout}
      point={props.point ?? null}
      class={`sim-center ${props.class ?? ''}`}
    />
  );
}
