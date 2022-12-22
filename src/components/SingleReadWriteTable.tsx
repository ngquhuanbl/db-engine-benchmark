import { ArrowRightIcon } from "@chakra-ui/icons";
import {
  TableContainer,
  Table,
  TableCaption,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  Flex,
  IconButton,
  Text,
  useToast,
  Heading,
} from "@chakra-ui/react";
import React, { useCallback, useState } from "react";
import { Data } from "../types/data";
import { SingleReadWriteResult } from "../types/result";
import { singleReadWrite as executeIndexedDB } from "../helpers/indexedDB/actions";
import { singleReadWrite as executeSQLite } from "../helpers/sqlite/actions";
import { convertMsToS } from "../helpers/convert";

interface Props {
  dataset: Array<Data>;
  addLog(content: string): number;
  removeLog(logId: number): void;
}

const formatResult = (
  result: SingleReadWriteResult
): SingleReadWriteResult => ({
  nTransactionRead: convertMsToS(result.nTransactionRead),
  nTransactionWrite: convertMsToS(result.nTransactionWrite),
  oneTransactionRead: convertMsToS(result.oneTransactionRead),
  oneTransactionWrite: convertMsToS(result.oneTransactionWrite),
});

const SingleReadWriteTable: React.FC<Props> = ({
  dataset,
  addLog,
  removeLog,
}) => {
  const [indexedDBResult, setIndexedDBResult] =
    useState<SingleReadWriteResult | null>(null);
  const [sqliteResult, setSQLiteResult] =
    useState<SingleReadWriteResult | null>(null);

  const [isIndexedDBRunning, setIsIndexedDBRunning] = useState(false);
  const [isSQLiteRunning, setIsSQLiteRunning] = useState(false);

  const toast = useToast();

  const runIndexedDB = useCallback(() => {
    setIsIndexedDBRunning(true);

    setTimeout(() => {
      executeIndexedDB(dataset, addLog, removeLog)
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
  }, [dataset, toast, addLog, removeLog]);

  const runSQLite = useCallback(() => {
    setIsSQLiteRunning(true);

    executeSQLite(dataset, addLog, removeLog)
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

  return (
    <Flex direction="column" h="100%">
      <Heading size="sm" marginBottom={4}>Single read write</Heading>
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
  );
};

export default SingleReadWriteTable;
