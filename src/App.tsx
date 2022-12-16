import React, { useCallback, useRef, useState } from "react";

import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  Button,
  Center,
  Container,
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

import { DEFAULT_DATASET_SIZE } from "./constants/dataset";
import { convertMsToS } from "./helpers/convert";
import { delay } from "./helpers/delay";
import { generateData } from "./helpers/generate-data";
import { execute as executeIndexedDB } from "./helpers/indexedDB";
import { serializePromises } from "./helpers/serialize-promises";
import { execute as executeSQLite } from "./helpers/sqlite";
import { Data } from "./types/data";
import { LogObj } from "./types/logs";
import { Result } from "./types/result";

let logIdCounter = 0;

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [indexedDBResult, setIndexedDBResult] = useState<Result | null>(null);
  const [sqlitePlusContextBridgeResult, setSQLitePlusContextBridgeResult] =
    useState<Result | null>(null);
  const [sqliteOnlyResult, setSQLiteOnlyResult] = useState<Result | null>(null);

  const datasetRef = useRef<Array<Data>>([]);

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [
    isSQLitePlusContextBridgeRunning,
    setIsSQLitePlusContextBridgeRunning,
  ] = useState(false);
  const [isSQLiteOnlyRunning, setIsSQLiteOnlyRunning] = useState(false);

  const toast = useToast();

  const [logs, setLogs] = useState<Array<LogObj>>([]);

  const isRunning =
    isIndexedDBRunning ||
    isSQLitePlusContextBridgeRunning ||
    isSQLiteOnlyRunning;

  const addLog = useCallback((content: string) => {
    const id = logIdCounter++;
    const logObj: LogObj = { id, content };
    setLogs((prevState) => [...prevState, logObj]);
    return id;
  }, []);

  const removeLog = useCallback((id: number) => {
    setLogs((prevState) =>
      prevState.filter(({ id: currentId }) => currentId !== id)
    );
  }, []);

  const getDataset = useCallback(() => {
    const newDatasetSize = inputRef.current ? +inputRef.current.value : 0;

    const existedDatasetSize = datasetRef.current.length;

    if (newDatasetSize !== existedDatasetSize) {
      const logId = addLog("[common] Generate data ...");
      // Generate new dataset
      datasetRef.current = generateData(newDatasetSize);
      removeLog(logId);
    }
    return datasetRef.current;
  }, [addLog, removeLog]);

  const runIndexedDB = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsIndexedDBRunning(true);

      setTimeout(() => {
        const dataset = getDataset();
        executeIndexedDB(dataset, addLog, removeLog)
          .then((result) => {
            setIndexedDBResult({
              nTransactionRead: convertMsToS(result.nTransactionRead),
              nTransactionWrite: convertMsToS(result.nTransactionWrite),
              oneTransactionRead: convertMsToS(result.oneTransactionRead),
              oneTransactionWrite: convertMsToS(result.oneTransactionWrite),
            });
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
            resolve();
          });
      });
    });
  }, [getDataset, toast, addLog, removeLog]);

  const runSQLitePlusContextBridge = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsSQLitePlusContextBridgeRunning(true);
      const dataset = getDataset();

      executeSQLite(dataset, addLog, removeLog)
        .then((result) => {
          setSQLitePlusContextBridgeResult({
            nTransactionRead: convertMsToS(result.nTransactionRead),
            nTransactionWrite: convertMsToS(result.nTransactionWrite),
            oneTransactionRead: convertMsToS(result.oneTransactionRead),
            oneTransactionWrite: convertMsToS(result.oneTransactionWrite),
          });
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
          setIsSQLitePlusContextBridgeRunning(false);
          resolve();
        });
    });
  }, [getDataset, toast, addLog, removeLog]);

  const runSQLiteOnly = useCallback(() => {
    return new Promise<void>((resolve) => {
      setIsSQLiteOnlyRunning(true);
      const dataset = getDataset();

      rawSqlite3.Database.execute(dataset, addLog, removeLog)
        .then((result) => {
          setSQLiteOnlyResult({
            nTransactionRead: convertMsToS(result.nTransactionRead),
            nTransactionWrite: convertMsToS(result.nTransactionWrite),
            oneTransactionRead: convertMsToS(result.oneTransactionRead),
            oneTransactionWrite: convertMsToS(result.oneTransactionWrite),
          });
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
          setIsSQLiteOnlyRunning(false);
          resolve();
        });
    });
  }, [getDataset, toast, addLog, removeLog]);

  const runAll = useCallback(() => {
    serializePromises([
      () => runIndexedDB(),
      () => delay(0),
      () => runSQLiteOnly(),
      () => delay(0),
      () => runSQLitePlusContextBridge(),
    ]);
  }, [runIndexedDB, runSQLitePlusContextBridge, runSQLiteOnly]);

  return (
    <Container
      padding={4}
      minW={700}
      height="100vh"
      display="flex"
      flexDir="column"
      alignItems="center"
      justifyContent="center"
    >
      <Center>
        <Heading size="lg">
          DB engine benchmark{" "}
          <span role="img" aria-label="">
            🧪
          </span>
        </Heading>
      </Center>
      <Flex
        flexDirection={"column"}
        alignItems={"flex-start"}
        marginTop={"6"}
        w="100%"
      >
        <FormControl display="flex" alignItems="center" isDisabled={isRunning}>
          <FormLabel margin="0" marginRight="4">
            Dataset size (n):
          </FormLabel>
          <NumberInput min={1} defaultValue={DEFAULT_DATASET_SIZE} flexGrow={1}>
            <NumberInputField ref={inputRef} />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
        <TableContainer marginTop={8} w="100%">
          <Table variant="simple">
            <TableCaption>
              Unit of measurement is <Text as="b">second</Text>.
            </TableCaption>
            <Thead>
              <Tr>
                <Th rowSpan={2} width={280}>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>DB Engine</Text>
                    <Button
                      leftIcon={<ArrowRightIcon />}
                      colorScheme="blue"
                      variant="solid"
                      isLoading={isRunning}
                      size="sm"
                      onClick={runAll}
                    >
                      Run all
                    </Button>
                  </Flex>
                </Th>
                <Th colSpan={2} textAlign="center">
                  n transaction
                </Th>
                <Th colSpan={2} textAlign="center">
                  1 transaction
                </Th>
              </Tr>
              <Tr>
                <Th textAlign="center">Read</Th>
                <Th textAlign="center">Write</Th>
                <Th textAlign="center">Read</Th>
                <Th textAlign="center">Write</Th>
              </Tr>
            </Thead>
            <Tbody>
              <Tr>
                <Td>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>IndexedDB</Text>
                    <IconButton
                      colorScheme="teal"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isIndexedDBRunning}
                      isDisabled={isRunning}
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
                  <>
                    <Td textAlign="center">
                      {indexedDBResult === null
                        ? "..."
                        : indexedDBResult.nTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {indexedDBResult === null
                        ? "..."
                        : indexedDBResult.nTransactionWrite}
                    </Td>
                    <Td textAlign="center">
                      {indexedDBResult === null
                        ? "..."
                        : indexedDBResult.oneTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {indexedDBResult === null
                        ? "..."
                        : indexedDBResult.oneTransactionWrite}
                    </Td>
                  </>
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
                      isLoading={isSQLiteOnlyRunning}
                      isDisabled={isRunning}
                      aria-label={"run SQLite only"}
                      onClick={runSQLiteOnly}
                    />
                  </Flex>
                </Td>
                {isSQLiteOnlyRunning ? (
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  <>
                    <Td textAlign="center">
                      {sqliteOnlyResult === null
                        ? "..."
                        : sqliteOnlyResult.nTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqliteOnlyResult === null
                        ? "..."
                        : sqliteOnlyResult.nTransactionWrite}
                    </Td>
                    <Td textAlign="center">
                      {sqliteOnlyResult === null
                        ? "..."
                        : sqliteOnlyResult.oneTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqliteOnlyResult === null
                        ? "..."
                        : sqliteOnlyResult.oneTransactionWrite}
                    </Td>
                  </>
                )}
              </Tr>
              <Tr>
                <Td>
                  <Flex justifyContent={"space-between"} alignItems="center">
                    <Text>
                      SQLite <b>+ contextBridge</b>
                    </Text>
                    <IconButton
                      colorScheme="teal"
                      icon={<ArrowRightIcon />}
                      size="sm"
                      isLoading={isSQLitePlusContextBridgeRunning}
                      isDisabled={isRunning}
                      aria-label={"run SQLite plus contextBridge"}
                      onClick={runSQLitePlusContextBridge}
                    />
                  </Flex>
                </Td>
                {isSQLitePlusContextBridgeRunning ? (
                  <Td backgroundColor="gray.100" colSpan={4} textAlign="center">
                    Running...
                  </Td>
                ) : (
                  <>
                    <Td textAlign="center">
                      {sqlitePlusContextBridgeResult === null
                        ? "..."
                        : sqlitePlusContextBridgeResult.nTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqlitePlusContextBridgeResult === null
                        ? "..."
                        : sqlitePlusContextBridgeResult.nTransactionWrite}
                    </Td>
                    <Td textAlign="center">
                      {sqlitePlusContextBridgeResult === null
                        ? "..."
                        : sqlitePlusContextBridgeResult.oneTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqlitePlusContextBridgeResult === null
                        ? "..."
                        : sqlitePlusContextBridgeResult.oneTransactionWrite}
                    </Td>
                  </>
                )}
              </Tr>
            </Tbody>
          </Table>
        </TableContainer>
        <Flex alignItems="center" marginTop={5}>
          <Text fontSize={14} marginRight={2} fontWeight={600}>
            <span role="img" aria-label="">
              📃
            </span>{" "}
            Log:
          </Text>
          <Flex direction="column" gap="5px">
            {logs.map(({ id, content }) => (
              <Text key={id} fontSize={14}>
                {content}
              </Text>
            ))}
          </Flex>
        </Flex>
      </Flex>
    </Container>
  );
}

export default App;
