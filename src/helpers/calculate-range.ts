import { MSG_ID_LENGTH } from "../constants/dataset";

interface Range {
  from: string;
  to: string;
}
export function calculateRange(datasetSize: number): Range[] {
  if (datasetSize <= 3)
    return [
      {
        from: "0".padStart(MSG_ID_LENGTH, "0"),
        to: `${datasetSize - 1}`.padStart(MSG_ID_LENGTH, "0"),
      },
      {
        from: "0".padStart(MSG_ID_LENGTH, "0"),
        to: `${datasetSize - 1}`.padStart(MSG_ID_LENGTH, "0"),
      },
      {
        from: "0".padStart(MSG_ID_LENGTH, "0"),
        to: `${datasetSize - 1}`.padStart(MSG_ID_LENGTH, "0"),
      },
    ];

  const firstPivot = Math.round(datasetSize / 3);
  const secondPivot = firstPivot * 2;
  return [
    {
      from: "0".padStart(MSG_ID_LENGTH, "0"),
      to: `${firstPivot}`.padStart(MSG_ID_LENGTH, "0"),
    },
    {
      from: `${firstPivot + 1}`.padStart(MSG_ID_LENGTH, "0"),
      to: `${secondPivot}`.padStart(MSG_ID_LENGTH, "0"),
    },
    {
      from: `${secondPivot + 1}`.padStart(MSG_ID_LENGTH, "0"),
      to: `${datasetSize - 1}`.padStart(MSG_ID_LENGTH, "0"),
    },
  ];
}
