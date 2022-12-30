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
  NODE_INTEGRATION_SQLITE_COLOR,
  PRELOAD_SQLITE_COLOR,
  TIE_COLOR,
} from "../constants/comparison";
import { SINGLE_READ_WRITE_ORDER } from "../constants/run-all";
import { convertMsToS } from "../helpers/shared/convert";
import {
  listenToGetAllEvent,
  listenToRunAllEvent,
} from "../helpers/shared/events";
import { singleReadWrite as executeIndexedDB } from "../helpers/renderer/indexedDB/actions";
import { singleReadWrite as executePreloadedSQLite } from "../helpers/renderer/sqlite/actions";
import { singleReadWrite as executeNodeIntegrationSQLite } from "../helpers/renderer/sqlite-nodeIntegration/actions";
import { Entries, Keys } from "../types/shared/common";
import { SingleReadWriteResult } from "../types/shared/result";

interface Props {
  datasetSize: number;
  addLog(content: string): number;
  removeLog(logId: number): void;
  chartViewModeOn: boolean;
}

interface ChartSeries {
  read: ApexAxisChartSeries;
  write: ApexAxisChartSeries;
}
type ComparisonData = {
  [index in keyof SingleReadWriteResult]: ComparisonResult[];
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
  datasetSize,
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
  const [preloadedSQLiteResult, setPreloadedSQLiteResult] =
    useState<SingleReadWriteResult>({
      nTransactionRead: null,
      nTransactionWrite: null,
      oneTransactionRead: null,
      oneTransactionWrite: null,
    });

  const [nodeIntegrationSQLiteResult, setNodeIntegrationSQLiteResult] =
    useState<SingleReadWriteResult>({
      nTransactionRead: null,
      nTransactionWrite: null,
      oneTransactionRead: null,
      oneTransactionWrite: null,
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

    const readPreloadedSQLiteData = [];
    const writePreloadedSQLiteData = [];
    if (preloadedSQLiteResult) {
      const {
        nTransactionRead,
        nTransactionWrite,
        oneTransactionRead,
        oneTransactionWrite,
      } = preloadedSQLiteResult;
      readPreloadedSQLiteData.push(nTransactionRead, oneTransactionRead);
      writePreloadedSQLiteData.push(nTransactionWrite, oneTransactionWrite);
    }

    const readNodeIntegrationSQLiteData = [];
    const writeNodeIntegrationSQLiteData = [];
    if (nodeIntegrationSQLiteResult) {
      const {
        nTransactionRead,
        nTransactionWrite,
        oneTransactionRead,
        oneTransactionWrite,
      } = nodeIntegrationSQLiteResult;
      readNodeIntegrationSQLiteData.push(nTransactionRead, oneTransactionRead);
      writeNodeIntegrationSQLiteData.push(
        nTransactionWrite,
        oneTransactionWrite
      );
    }

    return {
      read: [
        {
          name: "IndexedDB",
          data: readIndexedDBData,
        },
        {
          name: "SQLite (preload)",
          data: readPreloadedSQLiteData,
        },
        {
          name: "SQLite (native)",
          data: readNodeIntegrationSQLiteData,
        },
      ],
      write: [
        {
          name: "IndexedDB",
          data: writeIndexedDBData,
        },
        {
          name: "SQLite (preload)",
          data: writePreloadedSQLiteData,
        },
        {
          name: "SQLite (native)",
          data: writeNodeIntegrationSQLiteData,
        },
      ],
    };
  }, [indexedDBResult, preloadedSQLiteResult, nodeIntegrationSQLiteResult]);

  const comparisonData = useMemo<ComparisonData>(() => {
    const res: ComparisonData = {
      nTransactionRead: [],
      nTransactionWrite: [],
      oneTransactionRead: [],
      oneTransactionWrite: [],
    };

    (Object.keys(res) as Keys<SingleReadWriteResult>).forEach((metricName) => {
      const indexedDBMetricValue = indexedDBResult[metricName];
      const preloadSQLiteMetricValue = preloadedSQLiteResult[metricName];
      const nodeIntegrationSQLiteMetricValue =
        nodeIntegrationSQLiteResult[metricName];

      if (
        indexedDBMetricValue !== null &&
        preloadSQLiteMetricValue !== null &&
        nodeIntegrationSQLiteMetricValue !== null
      ) {
        // if (
        //   indexedDBMetricValue === preloadSQLiteMetricValue &&
        //   preloadSQLiteMetricValue === nodeIntegrationSQLiteMetricValue
        // )
        //   res[metricName] = [ComparisonResult.TIE];
        // else {
        //   const metrics = [
        //     indexedDBMetricValue,
        //     preloadSQLiteMetricValue,
        //     nodeIntegrationSQLiteMetricValue,
        //   ];
        //   const min = Math.min(...metrics);

        //   if (min === indexedDBMetricValue)
        //     res[metricName].push(ComparisonResult.INDEXED_DB);
        //   if (min === preloadSQLiteMetricValue)
        //     res[metricName].push(ComparisonResult.PRELOAD_SQLITE);
        //   if (min === nodeIntegrationSQLiteMetricValue)
        //     res[metricName].push(ComparisonResult.NODE_INTEGRATION_SQLITE);
        // }

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

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    return executeIndexedDB(datasetSize, addLog, removeLog)
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
  }, [datasetSize, toast, addLog, removeLog]);

  const runPreloadedSQLite = useCallback(() => {
    setIsPreloadedSQLiteRunning(true);

    return executePreloadedSQLite(datasetSize, addLog, removeLog)
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
  }, [datasetSize, toast, addLog, removeLog]);

  const runNodeIntegrationSQLite = useCallback(() => {
    setIsNodeIntegrationSQLiteRunning(true);

    return executeNodeIntegrationSQLite(datasetSize)
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
  }, [datasetSize, toast]);

  useEffect(() => {
    listenToRunAllEvent(SINGLE_READ_WRITE_ORDER, () =>
      runIndexedDB()
        .then(() => runPreloadedSQLite())
        .then(() => runNodeIntegrationSQLite())
    );
  }, [runIndexedDB, runPreloadedSQLite, runNodeIntegrationSQLite]);

  useEffect(() => {
    listenToGetAllEvent("single-read-write", () => ({
      indexedDB: indexedDBResult,
      preloadedSQLite: preloadedSQLiteResult,
      nodeIntegrationSQLite: nodeIntegrationSQLiteResult,
    }));
  }, [indexedDBResult, preloadedSQLiteResult, nodeIntegrationSQLiteResult]);

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
        <TableContainer w="100%" height="400px" marginTop="auto">
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
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  (
                    Object.entries(
                      preloadedSQLiteResult!
                    ) as Entries<SingleReadWriteResult>
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
                    ) as Entries<SingleReadWriteResult>
                  ).map(([metricName, metricValue]) => {
                    const comparisonResult = comparisonData[metricName];
                    let bgColor: string | undefined = undefined;
                    let color: string | undefined = undefined;
                    if (comparisonResult.includes(ComparisonResult.TIE)) {
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

export default SingleReadWriteTable;
