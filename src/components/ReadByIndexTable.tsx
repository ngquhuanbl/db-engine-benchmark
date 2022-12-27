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
  PRELOAD_SQLITE_COLOR,
  TIE_COLOR,
} from "../constants/comparison";
import {
  DEFAULT_NUM_OF_INDEXED_KEYS,
  MIN_NUM_OF_INDEXED_KEYS,
} from "../constants/dataset";
import { READ_BY_INDEX_ORDER } from "../constants/run-all";
import { convertMsToS } from "../helpers/shared/convert";
import {
  listenToGetAllEvent,
  listenToRunAllEvent,
} from "../helpers/shared/events";
import { getConvId } from "../helpers/shared/generate-data";
import { readByIndex as executeIndexedDB } from "../helpers/renderer/indexedDB/actions";
import { readByIndex as executePreloadedSQLite } from "../helpers/renderer/sqlite/actions";
import { Entries, Keys } from "../types/shared/common";
import { ReadByIndexResult } from "../types/shared/result";

const formatResult = (result: ReadByIndexResult): ReadByIndexResult => ({
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
  [index in keyof ReadByIndexResult]: ComparisonResult;
};

interface Props {
  addLog(content: string): number;
  removeLog(logId: number): void;
  chartViewModeOn: boolean;
}

const ReadByIndexTable: React.FC<Props> = ({
  addLog,
  removeLog,
  chartViewModeOn,
}) => {
  const [numOfKeys, setNumOfKeys] = useState(DEFAULT_NUM_OF_INDEXED_KEYS);
  const [indexedDBResult, setIndexedDBResult] = useState<ReadByIndexResult>({
    nTransactionAverage: null,
    nTransactionSum: null,
    oneTransactionAverage: null,
    oneTransactionSum: null,
  });
  const [preloadedSQLiteResult, setPreloadedSQLiteResult] =
    useState<ReadByIndexResult>({
      nTransactionAverage: null,
      nTransactionSum: null,
      oneTransactionAverage: null,
      oneTransactionSum: null,
    });
  const [nodeIntegrationSQLiteResult, setNodeIntegrationSQLiteResult] =
    useState<ReadByIndexResult>({
      nTransactionAverage: null,
      nTransactionSum: null,
      oneTransactionAverage: null,
      oneTransactionSum: null,
    });

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isPreloadedSQLiteRunning, setIsPreloadedSQLiteRunning] =
    useState(false);
  const [isNodeIntegrationSQLiteRunning, setIsNodeIntegrationSQLiteRunning] =
    useState(false);

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
    if (preloadedSQLiteResult) {
      const { nTransactionSum, oneTransactionSum } = preloadedSQLiteResult;
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
  }, [indexedDBResult, preloadedSQLiteResult]);

  const comparisonData = useMemo<ComparisonData>(() => {
    const res: ComparisonData = {
      nTransactionSum: ComparisonResult.NO_DATA,
      nTransactionAverage: ComparisonResult.NO_DATA,
      oneTransactionSum: ComparisonResult.NO_DATA,
      oneTransactionAverage: ComparisonResult.NO_DATA,
    };

    (Object.keys(res) as Keys<ReadByIndexResult>).forEach((metricName) => {
      const indexedDBMetricValue = indexedDBResult[metricName];
      const sqliteMetricValue = preloadedSQLiteResult[metricName];
      if (indexedDBMetricValue !== null && sqliteMetricValue !== null) {
        if (indexedDBMetricValue < sqliteMetricValue)
          res[metricName] = ComparisonResult.INDEXED_DB;
        else if (indexedDBMetricValue > sqliteMetricValue)
          res[metricName] = ComparisonResult.PRELOAD_SQLITE;
        else res[metricName] = ComparisonResult.TIE;
      }
    });

    return res;
  }, [indexedDBResult, preloadedSQLiteResult]);

  const keys = useMemo(() => {
    const res: string[] = [];
    for (let i = 0; i < numOfKeys; i += 1) {
      res.push(getConvId());
    }
    return res;
  }, [numOfKeys]);

  const toast = useToast();

  const handleNumOfIndexedKeysChange = useCallback((value) => {
    setNumOfKeys(value);
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    return executeIndexedDB(addLog, removeLog, { keys })
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
  }, [toast, addLog, removeLog, keys]);

  const runPreloadedSQLite = useCallback(() => {
    setIsPreloadedSQLiteRunning(true);

    return executePreloadedSQLite(addLog, removeLog, { keys })
      .then((result) => {
        setPreloadedSQLiteResult(formatResult(result));
      })
      .catch((e) => {
        toast({
          title: "Preloaded SQLite error",
          description: e.message,
          status: "error",
        });
        console.error(e);
      })
      .finally(() => {
        setIsPreloadedSQLiteRunning(false);
      });
  }, [toast, addLog, removeLog, keys]);

  useEffect(() => {
    listenToRunAllEvent(READ_BY_INDEX_ORDER, () =>
      runIndexedDB().then(() => runPreloadedSQLite())
    );
  }, [runIndexedDB, runPreloadedSQLite]);

  useEffect(() => {
    listenToGetAllEvent("read-by-index", () => ({
      indexedDB: indexedDBResult,
      preloadedSQLite: preloadedSQLiteResult,
      nodeIntegrationSQLite: null,
    }));
  }, [indexedDBResult, preloadedSQLiteResult]);

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>
        Read using index
      </Heading>
      <FormControl display="flex" alignItems="center" marginBottom={2}>
        <FormLabel margin="0" marginRight="4">
          Num of indexed keys (m):
        </FormLabel>
        <NumberInput
          min={MIN_NUM_OF_INDEXED_KEYS}
          flexGrow={1}
          value={numOfKeys}
          onChange={handleNumOfIndexedKeysChange}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>
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
              isLoading={isPreloadedSQLiteRunning}
              onClick={runPreloadedSQLite}
              ml={4}
            >
              Run preloaded SQLite
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
              Generated indexed keys are available in the dataset but can be
              non-unique.
              <br />
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
                    ) as Entries<ReadByIndexResult>
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
                    <Text>SQLite (preload)</Text>
                    <IconButton
                      colorScheme="teal"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isPreloadedSQLiteRunning}
                      aria-label={"run SQLite"}
                      onClick={runPreloadedSQLite}
                    />
                  </Flex>
                </Td>
                {isPreloadedSQLiteRunning ? (
                  <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      preloadedSQLiteResult!
                    ) as Entries<ReadByIndexResult>
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
                      case ComparisonResult.PRELOAD_SQLITE: {
                        bgColor = PRELOAD_SQLITE_COLOR;
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

export default ReadByIndexTable;
