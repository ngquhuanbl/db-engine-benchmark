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
  NODE_INTEGRATION_SQLITE_COLOR,
  PRELOAD_SQLITE_COLOR,
  TIE_COLOR,
} from "../constants/comparison";
import {
  DEFAULT_LIMIT,
  DEFAULT_READ_BY_LIMIT_COUNT,
  MIN_LIMIT,
  MIN_READ_BY_LIMIT_COUNT,
} from "../constants/dataset";
import { READ_BY_LIMIT_ORDER } from "../constants/run-all";
import { convertMsToS } from "../helpers/shared/convert";
import {
  listenToGetAllEvent,
  listenToRunAllEvent,
} from "../helpers/shared/events";
import { readByLimit as executeIndexedDB } from "../helpers/renderer/indexedDB/actions";
import { readByLimit as executePreloadedSQLite } from "../helpers/renderer/sqlite/actions";
import { readByLimit as executeNodeIntegrationSQLite } from "../helpers/renderer/sqlite-nodeIntegration/actions";

import { Entries, Keys } from "../types/shared/common";
import { ReadByLimitResult } from "../types/shared/result";

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
  [index in keyof ReadByLimitResult]: ComparisonResult[];
};

interface Props {
  addLog(content: string): number;
  removeLog(logId: number): void;
  chartViewModeOn: boolean;
}

const ReadByLimitTable: React.FC<Props> = ({
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
  const [preloadedSQLiteResult, setPreloadedSQLiteResult] =
    useState<ReadByLimitResult>({
      nTransactionAverage: null,
      nTransactionSum: null,
      oneTransactionAverage: null,
      oneTransactionSum: null,
    });
  const [nodeIntegrationSQLiteResult, setNodeIntegrationSQLiteResult] =
    useState<ReadByLimitResult>({
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

    const nodeIntegrationSQLiteData = [];
    if (nodeIntegrationSQLiteResult) {
      const { nTransactionSum, oneTransactionSum } =
        nodeIntegrationSQLiteResult;
      nodeIntegrationSQLiteData.push(nTransactionSum, oneTransactionSum);
    }

    return [
      {
        name: "IndexedDB",
        data: indexedDBData,
      },
      {
        name: "SQLite (preload)",
        data: sqliteData,
      },
      {
        name: "SQLite (native)",
        data: nodeIntegrationSQLiteData,
      },
    ];
  }, [indexedDBResult, preloadedSQLiteResult, nodeIntegrationSQLiteResult]);

  const comparisonData = useMemo<ComparisonData>(() => {
    const res: ComparisonData = {
      nTransactionSum: [],
      nTransactionAverage: [],
      oneTransactionSum: [],
      oneTransactionAverage: [],
    };

    (Object.keys(res) as Keys<ReadByLimitResult>).forEach((metricName) => {
      const indexedDBMetricValue = indexedDBResult[metricName];
      const preloadSQLiteMetricValue = preloadedSQLiteResult[metricName];
      const nodeIntegrationSQLiteMetricValue =
        nodeIntegrationSQLiteResult[metricName];
      if (indexedDBMetricValue !== null && preloadSQLiteMetricValue !== null) {
        if (indexedDBMetricValue === preloadSQLiteMetricValue)
          res[metricName].push(ComparisonResult.TIE);
        else if (indexedDBMetricValue < preloadSQLiteMetricValue)
          res[metricName].push(ComparisonResult.INDEXED_DB);
        else res[metricName].push(ComparisonResult.PRELOAD_SQLITE);

        const min = Math.min(
          indexedDBMetricValue,
          preloadSQLiteMetricValue,
          nodeIntegrationSQLiteMetricValue
        );
        if (min === nodeIntegrationSQLiteMetricValue)
          res[metricName].push(ComparisonResult.NODE_INTEGRATION_SQLITE);
      }
    });

    return res;
  }, [indexedDBResult, preloadedSQLiteResult, nodeIntegrationSQLiteResult]);

  const toast = useToast();

  const handleReadCountChange = useCallback((count) => {
    setReadCount(count);
  }, []);

  const handleLimitChange = useCallback((count) => {
    setLimit(count);
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    return executeIndexedDB(addLog, removeLog, {
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
  }, [toast, addLog, removeLog, readCount, limit]);

  const runPreloadedSQLite = useCallback(() => {
    setIsPreloadedSQLiteRunning(true);

    return executePreloadedSQLite(addLog, removeLog, {
      count: readCount,
      limit,
    })
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
  }, [toast, addLog, removeLog, readCount, limit]);

  const runNodeIntegrationSQLite = useCallback(() => {
    setIsNodeIntegrationSQLiteRunning(true);

    return executeNodeIntegrationSQLite({
      count: readCount,
      limit,
    })
      .then((result) => {
        setNodeIntegrationSQLiteResult(formatResult(result));
      })
      .catch((e) => {
        toast({
          title: "NodeIntegration SQLite error",
          description: e.message,
          status: "error",
        });
        console.error(e);
      })
      .finally(() => {
        setIsNodeIntegrationSQLiteRunning(false);
      });
  }, [readCount, limit, toast]);

  useEffect(() => {
    listenToRunAllEvent(READ_BY_LIMIT_ORDER, () =>
      runIndexedDB()
        .then(() => runPreloadedSQLite())
        .then(() => runNodeIntegrationSQLite())
    );
  }, [runIndexedDB, runPreloadedSQLite, runNodeIntegrationSQLite]);

  useEffect(() => {
    listenToGetAllEvent("read-by-limit", () => ({
      indexedDB: indexedDBResult,
      preloadedSQLite: preloadedSQLiteResult,
      nodeIntegrationSQLite: nodeIntegrationSQLiteResult,
    }));
  }, [indexedDBResult, preloadedSQLiteResult, nodeIntegrationSQLiteResult]);

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
              isLoading={isPreloadedSQLiteRunning}
              onClick={runPreloadedSQLite}
              ml={4}
            >
              Run SQLite (preload)
            </Button>
            <Button
              leftIcon={<ArrowRightIcon />}
              colorScheme="gray"
              size="sm"
              isLoading={isNodeIntegrationSQLiteRunning}
              onClick={runNodeIntegrationSQLite}
              ml={4}
            >
              Run SQLite (native)
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
        <TableContainer w="100%" height="400px" marginTop="auto">
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
                    if (comparisonResult.includes(ComparisonResult.TIE)) {
                      bgColor = TIE_COLOR;
                      color = "white";
                    } else if (
                      comparisonResult.includes(ComparisonResult.INDEXED_DB)
                    ) {
                      bgColor = INDEXED_DB_COLOR;
                      color = "white";
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
                    ) as Entries<ReadByLimitResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    if (comparisonResult.includes(ComparisonResult.TIE)) {
                      bgColor = TIE_COLOR;
                      color = "white";
                    } else if (
                      comparisonResult.includes(ComparisonResult.PRELOAD_SQLITE)
                    ) {
                      bgColor = PRELOAD_SQLITE_COLOR;
                      color = "white";
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
                <Td colSpan={5} bgColor="gray.700" color="white">
                  Metrics for reference{" "}
                  <span role="img" aria-label="below">
                    👇
                  </span>
                </Td>
              </Tr>
              <Tr>
                <Td>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>SQLite (native)</Text>
                    <IconButton
                      colorScheme="gray"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isNodeIntegrationSQLiteRunning}
                      aria-label={"run SQLite"}
                      onClick={runNodeIntegrationSQLite}
                    />
                  </Flex>
                </Td>
                {isNodeIntegrationSQLiteRunning ? (
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      nodeIntegrationSQLiteResult!
                    ) as Entries<ReadByLimitResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    if (comparisonResult.includes(ComparisonResult.TIE) && metricValue !== null) {
                      bgColor = TIE_COLOR;
                      color = "white";
                    } else if (
                      comparisonResult.includes(
                        ComparisonResult.NODE_INTEGRATION_SQLITE
                      )
                    ) {
                      bgColor = NODE_INTEGRATION_SQLITE_COLOR;
                      color = "white";
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
