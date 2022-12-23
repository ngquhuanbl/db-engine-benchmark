import { ApexOptions } from "apexcharts";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  Heading,
  IconButton,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from "@chakra-ui/react";

import {
  ComparisonResult,
  INDEXED_DB_COLOR,
  SQLITE_COLOR,
  TIE_COLOR,
} from "../constants/comparison";
import { SINGLE_READ_WRITE_ORDER } from "../constants/run-all";
import { convertMsToS } from "../helpers/convert";
import { listenToGetAllEvent, listenToRunAllEvent } from "../helpers/events";
import { singleReadWrite as executeIndexedDB } from "../helpers/indexedDB/actions";
import { singleReadWrite as executeSQLite } from "../helpers/sqlite/actions";
import { Entries, Keys } from "../types/common";
import { Data } from "../types/data";
import { SingleReadWriteResult } from "../types/result";

interface Props {
  dataset: Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
  chartViewModeOn: boolean;
}

interface ChartSeries {
  read: ApexAxisChartSeries;
  write: ApexAxisChartSeries;
}
type ComparisonData = {
  [index in keyof SingleReadWriteResult]: ComparisonResult;
};

const formatResult = (
  result: SingleReadWriteResult
): SingleReadWriteResult => ({
  nTransactionRead:
    result.nTransactionRead !== null
      ? convertMsToS(result.nTransactionRead)
      : null,
  nTransactionWrite:
    result.nTransactionWrite !== null
      ? convertMsToS(result.nTransactionWrite)
      : null,
  oneTransactionRead:
    result.oneTransactionRead !== null
      ? convertMsToS(result.oneTransactionRead)
      : null,
  oneTransactionWrite:
    result.oneTransactionWrite !== null
      ? convertMsToS(result.oneTransactionWrite)
      : null,
});

const SingleReadWriteTable: React.FC<Props> = ({
  dataset,
  addLog,
  removeLog,
  chartViewModeOn,
}) => {
  const [indexedDBResult, setIndexedDBResult] = useState<SingleReadWriteResult>(
    {
      nTransactionRead: null,
      nTransactionWrite: null,
      oneTransactionRead: null,
      oneTransactionWrite: null,
    }
  );
  const [sqliteResult, setSQLiteResult] = useState<SingleReadWriteResult>({
    nTransactionRead: null,
    nTransactionWrite: null,
    oneTransactionRead: null,
    oneTransactionWrite: null,
  });

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const chartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        height: 350,
      },
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "55%",
          endingShape: "rounded",
        },
      },
      dataLabels: {
        enabled: false,
      },
      stroke: {
        show: true,
        width: 2,
        colors: ["transparent"],
      },
      xaxis: {
        categories: ["n transaction(s)", "1 transaction"],
      },
      yaxis: {
        title: {
          text: "ms",
        },
      },
      fill: {
        opacity: 1,
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            return val + " ms";
          },
        },
      },
      theme: {
        palette: "palette7",
      },
    }),
    []
  );

  const chartSeries = useMemo<ChartSeries>(() => {
    const readIndexedDBData = [];
    const writeIndexedDBData = [];
    if (indexedDBResult) {
      const {
        nTransactionRead,
        nTransactionWrite,
        oneTransactionRead,
        oneTransactionWrite,
      } = indexedDBResult;
      readIndexedDBData.push(nTransactionRead, oneTransactionRead);
      writeIndexedDBData.push(nTransactionWrite, oneTransactionWrite);
    }

    const readSQLiteData = [];
    const writeSQLiteData = [];
    if (sqliteResult) {
      const {
        nTransactionRead,
        nTransactionWrite,
        oneTransactionRead,
        oneTransactionWrite,
      } = sqliteResult;
      readSQLiteData.push(nTransactionRead, oneTransactionRead);
      writeSQLiteData.push(nTransactionWrite, oneTransactionWrite);
    }

    return {
      read: [
        {
          name: "IndexedDB",
          data: readIndexedDBData,
        },
        {
          name: "SQLite",
          data: readSQLiteData,
        },
      ],
      write: [
        {
          name: "IndexedDB",
          data: writeIndexedDBData,
        },
        {
          name: "SQLite",
          data: writeSQLiteData,
        },
      ],
    };
  }, [indexedDBResult, sqliteResult]);

  const comparisonData = useMemo<ComparisonData>(() => {
    const res: ComparisonData = {
      nTransactionRead: ComparisonResult.NO_DATA,
      nTransactionWrite: ComparisonResult.NO_DATA,
      oneTransactionRead: ComparisonResult.NO_DATA,
      oneTransactionWrite: ComparisonResult.NO_DATA,
    };

    (Object.keys(res) as Keys<SingleReadWriteResult>).forEach((metricName) => {
      const indexedDBMetricValue = indexedDBResult[metricName];
      const sqliteMetricValue = sqliteResult[metricName];
      if (indexedDBMetricValue !== null && sqliteMetricValue !== null) {
        if (indexedDBMetricValue < sqliteMetricValue)
          res[metricName] = ComparisonResult.INDEXED_DB;
        else if (indexedDBMetricValue > sqliteMetricValue)
          res[metricName] = ComparisonResult.SQLITE;
        else res[metricName] = ComparisonResult.TIE;
      }
    });

    return res;
  }, [indexedDBResult, sqliteResult]);

  const toast = useToast();

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    return executeIndexedDB(dataset, addLog, removeLog)
      .then((result) => {
        setIndexedDBResult(formatResult(result));
      })
      .catch((e) => {
        toast({
          title: "IndexedDB error",
          description: e.message,
          status: "error",
        });
        console.error(e);
      })
      .finally(() => {
        setIsIndexedDBRunning(false);
      });
  }, [dataset, toast, addLog, removeLog]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);

    return executeSQLite(dataset, addLog, removeLog)
      .then((result) => {
        setSQLiteResult(formatResult(result));
      })
      .catch((e) => {
        toast({
          title: "SQLite error",
          description: e.message,
          status: "error",
        });
        console.error(e);
      })
      .finally(() => {
        setIsSQLiteRunning(false);
      });
  }, [dataset, toast, addLog, removeLog]);

  useEffect(() => {
    listenToRunAllEvent(SINGLE_READ_WRITE_ORDER, () =>
      runIndexedDB().then(() => runSQLite())
    );
  }, [runIndexedDB, runSQLite]);

  useEffect(() => {
    listenToGetAllEvent("single-read-write", () => ({
      indexedDB: indexedDBResult,
      sqlite: sqliteResult,
    }));
  }, [indexedDBResult, sqliteResult]);

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>
        Single read write
      </Heading>
      {chartViewModeOn ? (
        <Flex flexDirection="column" marginTop="auto">
          <Flex>
            <Button
              leftIcon={<ArrowRightIcon />}
              colorScheme="red"
              size="sm"
              isLoading={isIndexedDBRunning}
              onClick={runIndexedDB}
            >
              Run IndexedDb
            </Button>
            <Button
              leftIcon={<ArrowRightIcon />}
              colorScheme="teal"
              size="sm"
              isLoading={isSQLiteRunning}
              onClick={runSQLite}
              ml={4}
            >
              Run SQLite
            </Button>
          </Flex>
          <Flex mt={4}>
            <Flex flexDirection="column" alignItems="center" mr={8}>
              <ReactApexChart
                options={chartOptions}
                series={chartSeries.read}
                type="bar"
                height={350}
              />
              <Heading size="xs" textTransform="uppercase">
                Read
              </Heading>
            </Flex>
            <Flex flexDirection="column" alignItems="center">
              <ReactApexChart
                options={chartOptions}
                series={chartSeries.write}
                type="bar"
                height={350}
              />
              <Heading size="xs" textTransform="uppercase">
                Write
              </Heading>
            </Flex>
          </Flex>
        </Flex>
      ) : (
        <TableContainer w="100%" height="285px" marginTop="auto">
          <Table variant="simple">
            <TableCaption>
              Unit of measurement is <Text as="b">second</Text>.
            </TableCaption>
            <Thead>
              <Tr>
                <Th rowSpan={2} width={270}>
                  DB Engine
                </Th>
                <Th colSpan={2} textAlign="center">
                  n transaction
                </Th>
                <Th colSpan={2} textAlign="center">
                  1 transaction
                </Th>
              </Tr>
              <Tr>
                <Th textAlign="center">Read (total)</Th>
                <Th textAlign="center">Write (total)</Th>
                <Th textAlign="center">Read (total)</Th>
                <Th textAlign="center">Write (total)</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>IndexedDB</Text>
                    <IconButton
                      colorScheme="red"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isIndexedDBRunning}
                      aria-label={"run IndexedDB"}
                      onClick={runIndexedDB}
                    />
                  </Flex>
                </Td>
                {isIndexedDBRunning ? (
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      indexedDBResult!
                    ) as Entries<SingleReadWriteResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    switch (comparisonResult) {
                      case ComparisonResult.TIE: {
                        bgColor = TIE_COLOR;
                        break;
                      }
                      case ComparisonResult.INDEXED_DB: {
                        bgColor = INDEXED_DB_COLOR;
                        color = "white";
                        break;
                      }
                      default:
                    }
                    return (
                      <Td
                        key={metricName}
                        textAlign="center"
                        bgColor={bgColor}
                        color={color}
                      >
                        {metricValue === null ? "..." : `${metricValue} `}
                      </Td>
                    );
                  })
                )}
              </Tr>
              <Tr>
                <Td>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>SQLite</Text>
                    <IconButton
                      colorScheme="teal"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isSQLiteRunning}
                      aria-label={"run SQLite"}
                      onClick={runSQLite}
                    />
                  </Flex>
                </Td>
                {isSQLiteRunning ? (
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      sqliteResult!
                    ) as Entries<SingleReadWriteResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    switch (comparisonResult) {
                      case ComparisonResult.TIE: {
                        bgColor = TIE_COLOR;
                        break;
                      }
                      case ComparisonResult.SQLITE: {
                        bgColor = SQLITE_COLOR;
                        color = "white";
                        break;
                      }
                      default:
                    }
                    return (
                      <Td
                        key={metricName}
                        textAlign="center"
                        bgColor={bgColor}
                        color={color}
                      >
                        {metricValue === null ? "..." : `${metricValue} `}
                      </Td>
                    );
                  })
                )}
              </Tr>
            </Tbody>
          </Table>
        </TableContainer>
      )}
    </Flex>
  );
};

export default SingleReadWriteTable;
