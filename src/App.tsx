import React, { useCallback, useRef, useState } from "react";
import {
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
import { ArrowRightIcon } from "@chakra-ui/icons";
import { Result } from "./types/result";

import { execute as executeIndexedDB } from "./helpers/indexedDB";
import { execute as executeSQLite } from "./helpers/sqlite";
import { Data } from "./types/data";
import { generateData } from "./helpers/generate-data";
import { convertMsToS } from "./helpers/convert";

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [indexedDBResult, setIndexedDBResult] = useState<Result | null>(null);
  const [sqliteResult, setSQLiteResult] = useState<Result | null>(null);
  const datasetRef = useRef<Array<Data>>([]);

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const toast = useToast();

  const isRunning = isIndexedDBRunning || isSQLiteRunning;

  const getDataset = useCallback(() => {
    const newDatasetSize = inputRef.current ? +inputRef.current.value : 0;
    console.warn({ datasetSize: newDatasetSize });

    const existedDatasetSize = datasetRef.current.length;

    if (newDatasetSize !== existedDatasetSize) {
      // Generate new dataset
      datasetRef.current = generateData(newDatasetSize);
    }
    return datasetRef.current;
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    setTimeout(() => {
      const dataset = getDataset();
      executeIndexedDB(dataset)
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
        })
        .finally(() => {
          setIsIndexedDBRunning(false);
        });
    });
  }, [getDataset, toast]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);
    const dataset = getDataset();

    executeSQLite(dataset)
      .then((result) => {
        setSQLiteResult({
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
      })
      .finally(() => {
        setIsSQLiteRunning(false);
      });
  }, [getDataset, toast]);

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
        <Heading size="lg">DB engine benchmark 🧪</Heading>
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
          <NumberInput min={10} defaultValue={1000} flexGrow={1}>
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
                <Th rowSpan={2}>DB Engine</Th>
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
                  <>
                    <Td textAlign="center">
                      {sqliteResult === null
                        ? "..."
                        : sqliteResult.nTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqliteResult === null
                        ? "..."
                        : sqliteResult.nTransactionWrite}
                    </Td>
                    <Td textAlign="center">
                      {sqliteResult === null
                        ? "..."
                        : sqliteResult.oneTransactionRead}
                    </Td>
                    <Td textAlign="center">
                      {sqliteResult === null
                        ? "..."
                        : sqliteResult.oneTransactionWrite}
                    </Td>
                  </>
                )}
              </Tr>
            </Tbody>
          </Table>
        </TableContainer>
      </Flex>
    </Container>
  );
}

export default App;
