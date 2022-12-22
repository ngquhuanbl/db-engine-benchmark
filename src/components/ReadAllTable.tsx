import React, { useCallback, useState } from "react";
import { Data } from "../types/data";
import { ReadAllResult } from "../types/result";
import { readAll as executeIndexedDB } from "../helpers/indexedDB/actions";
import { readAll as executeSQLite } from "../helpers/sqlite/actions";
import {
  Flex,
  IconButton,
  Table,
  TableCaption,
  TableContainer,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Text,
  useToast,
  Heading,
  FormControl,
  FormLabel,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
} from "@chakra-ui/react";
import { convertMsToS } from "../helpers/convert";
import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  DEFAULT_READ_ALL_COUNT,
  MIN_READ_ALL_COUNT,
} from "../constants/dataset";

const formatResult = (result: ReadAllResult): ReadAllResult => ({
  nTransactionAverage: convertMsToS(result.nTransactionAverage),
  nTransactionSum: convertMsToS(result.nTransactionSum),
  oneTransactionAverage: convertMsToS(result.oneTransactionAverage),
  oneTransactionSum: convertMsToS(result.oneTransactionSum),
});

interface Props {
  dataset: Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
}

const ReadAllTable: React.FC<Props> = ({ dataset, addLog, removeLog }) => {
  const [readAllCount, setReadAllCount] = useState(DEFAULT_READ_ALL_COUNT);
  const [indexedDBResult, setIndexedDBResult] = useState<ReadAllResult | null>(
    null
  );
  const [sqliteResult, setSQLiteResult] = useState<ReadAllResult | null>(null);

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const toast = useToast();

  const handleReadAllCountChange = useCallback((count) => {
    setReadAllCount(count);
  }, []);

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    setTimeout(() => {
      executeIndexedDB(dataset, addLog, removeLog, { readAllCount })
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
    });
  }, [dataset, toast, addLog, removeLog, readAllCount]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);

    executeSQLite(dataset, addLog, removeLog, { readAllCount })
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
  }, [dataset, toast, addLog, removeLog, readAllCount]);

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>Read all</Heading>
      <FormControl display="flex" alignItems="center" marginBottom={2}>
        <FormLabel margin="0" marginRight="4">
          Read count (m):
        </FormLabel>
        <NumberInput
          min={MIN_READ_ALL_COUNT}
          flexGrow={1}
          value={readAllCount}
          onChange={handleReadAllCountChange}
        >
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
      </FormControl>
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
                <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                  Running...
                </Td>
              ) : (
                <>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.nTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.nTransactionAverage}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.oneTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {indexedDBResult === null
                      ? "..."
                      : indexedDBResult.oneTransactionAverage}
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
                <Td backgroundColor="gray.100" colSpan={6} textAlign="center">
                  Running...
                </Td>
              ) : (
                <>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.nTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.nTransactionAverage}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.oneTransactionSum}
                  </Td>
                  <Td textAlign="center">
                    {sqliteResult === null
                      ? "..."
                      : sqliteResult.oneTransactionAverage}
                  </Td>
                </>
              )}
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
    </Flex>
  );
};

export default ReadAllTable;
