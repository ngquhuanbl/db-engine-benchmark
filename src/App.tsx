import React, { useCallback, useRef, useState } from "react";
import {
  Container,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Text,
} from "@chakra-ui/react";

import { Data } from "./types/data";
import { generateData } from "./helpers/generate-data";
import { LogObj } from "./types/logs";
import { DEFAULT_DATASET_SIZE } from "./constants/dataset";
import SingleReadWriteTable from "./components/SingleReadWriteTable";
import ReadByRangeTable from "./components/ReadByRangeTable";

let logIdCounter = 0;

function App() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const datasetRef = useRef<Array<Data>>([]);

  const [logs, setLogs] = useState<Array<LogObj>>([]);

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

  return (
    <Container
      padding={4}
      minW={700}
      maxW="unset"
      height="100vh"
      display="flex"
      flexDir="column"
    >
      <Heading size="md" marginBottom={4}>
        DB engine benchmark{" "}
        <span role="img" aria-label="">
          🧪
        </span>
      </Heading>
      <Grid width="100%" templateColumns="repeat(2, 1fr)" gap={4}>
        <GridItem colStart={0} colEnd={1}>
          <FormControl display="flex" alignItems="center">
            <FormLabel margin="0" marginRight="4">
              Dataset size (n):
            </FormLabel>
            <NumberInput
              min={1}
              defaultValue={DEFAULT_DATASET_SIZE}
              flexGrow={1}
            >
              <NumberInputField ref={inputRef} />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </FormControl>
        </GridItem>
        <GridItem colStart={0} colEnd={1}>
          <Heading size="sm">Single read write</Heading>
          <SingleReadWriteTable
            getDataset={getDataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
        <GridItem colStart={0} colEnd={1}>
          <Heading size="sm">Read by range</Heading>
          <ReadByRangeTable
            getDataset={getDataset}
            addLog={addLog}
            removeLog={removeLog}
          />
        </GridItem>
      </Grid>
      <Flex marginTop="auto" height="68px" overflowY="auto">
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
    </Container>
  );
}

export default App;
