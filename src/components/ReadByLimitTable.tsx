import { ApexOptions } from "apexcharts";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactApexChart from "react-apexcharts";
import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  IconButton,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
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
import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
  MIN_LIMIT,
  MIN_READ_BY_LIMIT_COUNT,
} from "../constants/dataset";
import { READ_BY_LIMIT_ORDER } from "../constants/run-all";
import { convertMsToS } from "../helpers/convert";
import { listenToGetAllEvent, listenToRunAllEvent } from "../helpers/events";
import { readByLimit as executeIndexedDB } from "../helpers/indexedDB/actions";
import { readByLimit as executeSQLite } from "../helpers/sqlite/actions";
import { Entries, Keys } from "../types/common";
import { Data } from "../types/data";
import { ReadByLimitResult } from "../types/result";

const formatResult = (result: ReadByLimitResult): ReadByLimitResult => ({
  nTransactionAverage: result.nTransactionAverage
    ? convertMsToS(result.nTransactionAverage)
    : null,
  nTransactionSum: result.nTransactionSum
    ? convertMsToS(result.nTransactionSum)
    : null,
  oneTransactionAverage: result.oneTransactionAverage
    ? convertMsToS(result.oneTransactionAverage)
    : null,
  oneTransactionSum: result.oneTransactionSum
    ? convertMsToS(result.oneTransactionSum)
    : null,
});

type ComparisonData = {
  [index in keyof ReadByLimitResult]: ComparisonResult;
};

interface Props {
  dataset: Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
  chartViewModeOn: boolean;
}

const ReadByLimitTable: React.FC<Props> = ({
  dataset,
  addLog,
  removeLog,
  chartViewModeOn,
}) => {
  const [readCount, setReadCount] = useState(DEFAULT_READ_BY_LIMIT_COUNT);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const [indexedDBResult, setIndexedDBResult] = useState<ReadByLimitResult>({
    nTransactionAverage: null,
    nTransactionSum: null,
    oneTransactionAverage: null,
    oneTransactionSum: null,
  });
  const [sqliteResult, setSQLiteResult] = useState<ReadByLimitResult>({
    nTransactionAverage: null,
    nTransactionSum: null,
    oneTransactionAverage: null,
    oneTransactionSum: null,
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

  const chartSeries = useMemo<ApexAxisChartSeries>(() => {
    const indexedDBData = [];
    if (indexedDBResult) {
      const { nTransactionSum, oneTransactionSum } = indexedDBResult;
      indexedDBData.push(nTransactionSum, oneTransactionSum);
    }

    const sqliteData = [];
    if (sqliteResult) {
      const { nTransactionSum, oneTransactionSum } = sqliteResult;
      sqliteData.push(nTransactionSum, oneTransactionSum);
    }

    return [
      {
        name: "IndexedDB",
        data: indexedDBData,
      },
      {
        name: "SQLite",
        data: sqliteData,
      },
    ];
  }, [indexedDBResult, sqliteResult]);

  const comparisonData = useMemo<ComparisonData>(() => {
    const res: ComparisonData = {
      nTransactionSum: ComparisonResult.NO_DATA,
      nTransactionAverage: ComparisonResult.NO_DATA,
      oneTransactionSum: ComparisonResult.NO_DATA,
      oneTransactionAverage: ComparisonResult.NO_DATA,
    };

    (Object.keys(res) as Keys<ReadByLimitResult>).forEach((metricName) => {
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

  const handleReadCountChange = useCallback((count) => {
    setReadCount(count);
  }, []);

  const handleLimitChange = useCallback((count) => {
    setLimit(count);
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    return executeIndexedDB(dataset, addLog, removeLog, {
      count: readCount,
      limit,
    })
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
  }, [dataset, toast, addLog, removeLog, readCount, limit]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);

    return executeSQLite(dataset, addLog, removeLog, {
      count: readCount,
      limit,
    })
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
  }, [dataset, toast, addLog, removeLog, readCount, limit]);

  useEffect(() => {
    listenToRunAllEvent(READ_BY_LIMIT_ORDER, () =>
      runIndexedDB().then(() => runSQLite())
    );
  }, [runIndexedDB, runSQLite]);

  useEffect(() => {
    listenToGetAllEvent("read-by-limit", () => ({
      indexedDB: indexedDBResult,
      sqlite: sqliteResult,
    }));
  }, [indexedDBResult, sqliteResult]);

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>
        Read using limit
      </Heading>
      <Flex>
        <FormControl display="flex" alignItems="center" marginBottom={2}>
          <FormLabel margin="0" marginRight="4">
            Limit:
          </FormLabel>
          <NumberInput
            min={MIN_LIMIT}
            flexGrow={1}
            value={limit}
            onChange={handleLimitChange}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
        <FormControl
          display="flex"
          alignItems="center"
          marginBottom={2}
          marginLeft={4}
        >
          <FormLabel margin="0" marginRight="4">
            Read count (m):
          </FormLabel>
          <NumberInput
            min={MIN_READ_BY_LIMIT_COUNT}
            flexGrow={1}
            value={readCount}
            onChange={handleReadCountChange}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
      </Flex>
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
          <Flex flexDirection="column" alignItems="center">
            <ReactApexChart
              options={chartOptions}
              series={chartSeries}
              type="bar"
              height={350}
            />
            <Heading size="xs" textTransform="uppercase">
              Read
            </Heading>
          </Flex>
        </Flex>
      ) : (
        <TableContainer w="100%" height="285px" marginTop="auto">
          <Table variant="simple">
            <TableCaption>
              Reading uses the primary key.
              <br />
              Unit of measurement is <Text as="b">second</Text>.
            </TableCaption>
            <Thead>
              <Tr>
                <Th rowSpan={2} width={270}>
                  DB Engine
                </Th>
                <Th textAlign="center" colSpan={2}>
                  m transaction
                </Th>
                <Th textAlign="center" colSpan={2}>
                  1 transaction
                </Th>
              </Tr>
              <Tr>
                <Th textAlign="center">Read (Total)</Th>
                <Th textAlign="center">Read (Average)</Th>
                <Th textAlign="center">Read (Total)</Th>
                <Th textAlign="center">Read (Average)</Th>
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
                  <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      indexedDBResult!
                    ) as Entries<ReadByLimitResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    switch (comparisonResult) {
                      case ComparisonResult.TIE: {
                        bgColor = TIE_COLOR;
						color = "white";
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
                  <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(sqliteResult!) as Entries<ReadByLimitResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    switch (comparisonResult) {
                      case ComparisonResult.TIE: {
                        bgColor = TIE_COLOR;
						color = "white";
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

export default ReadByLimitTable;
