import React, { useCallback, useEffect, useState } from "react";

import {
  Button,
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
  Progress,
  Switch,
  Text,
  useToast,
} from "@chakra-ui/react";

import ReadAllTable from "./components/ReadAllTable";
import ReadByIndexTable from "./components/ReadByIndexTable";
import ReadByLimitTable from "./components/ReadByLimitTable";
import ReadByRangeTable from "./components/ReadByRangeTable";
import ReadFromTheEndOfSourceDataTable from "./components/ReadFromTheEndOfSourceDataTable";
import SingleReadWriteTable from "./components/SingleReadWriteTable";
import { DEFAULT_DATASET_SIZE, MIN_DATASET_SIZE } from "./constants/dataset";
import { DEFAULT_CHART_VIEW_MODE_ONE } from "./constants/modes";
import {
  triggerGetAllEvent,
  triggerRunAllEvent,
} from "./helpers/shared/events";
import { loadData } from "./helpers/renderer/indexedDB/load-data";
import { LogObj } from "./types/shared/logs";
import { ActionTypes } from "./constants/action-types";
import { MessageTypes } from "./constants/message";
import { AddLogMessageResult } from "./types/shared/message-port";

let logIdCounter = 0;

function App() {
  const [datasetSize, setDatasetSize] = useState(DEFAULT_DATASET_SIZE);

  const [chartViewModeOn, setChartViewModeOn] = useState(
    DEFAULT_CHART_VIEW_MODE_ONE
  );
  const handleChartViewModeOnChange = useCallback((event) => {
    setChartViewModeOn(event.target.checked);
  }, []);

  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState(10);

  const [logs, setLogs] = useState<Array<LogObj>>([]);
  const [prepareDataProgress, setPrepareDataProgress] = useState(0);

  const toast = useToast();

  const handleDatasetSizeChange = useCallback((size) => {
    setDatasetSize(+size);
  }, []);

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

  const getAllResult = useCallback(() => {
    const res = triggerGetAllEvent();
    navigator.clipboard.writeText(JSON.stringify(res));
    toast({
      title: "JSON result is copied! 📄",
      status: "info",
    });
  }, [toast]);

  const runAll = useCallback(() => {
    setIsRunningAll(true);
    triggerRunAllEvent((value) => setRunAllProgress(value)).finally(() =>
      setIsRunningAll(false)
    );
  }, []);

  useEffect(() => {
    setIsLoadingData(true);
    loadData().then((data) => {
      const size = data.length;
      if (size > 0) {
        setDatasetSize(size);
      }
      setIsLoadingData(false);
    });

    messageBroker.addMessageListener((_, request) => {
      const { id: msgId, type: msgType } = request;
      if (msgType === MessageTypes.REQUEST) {
        const { type: actionType, data } = request.params;
        switch (actionType) {
          case ActionTypes.ADD_LOG: {
            const { content } = data;
            const logId = addLog(content);

            const responseMessage: AddLogMessageResult = {
              id: msgId,
              type: MessageTypes.RESPONSE,
              result: {
                id: logId,
              },
            };
            messageBroker.sendMessage(responseMessage);
            break;
          }
          case ActionTypes.REMOVE_LOG: {
            const { id: logId } = data;
            removeLog(logId);
            break;
          }
        }
      }
    });
  }, [addLog, removeLog]);

  useEffect(() => {
    dataLoader.addProgressListener((_, value) => {
      console.log("received progress", value);
      setPrepareDataProgress(value);
    });
  }, []);

  return (
    <>
      <Container
        padding={4}
        minW={700}
        maxW="unset"
        minHeight="100vh"
        display="flex"
        flexDir="column"
      >
        <Heading size="md" marginBottom={4}>
          DB engine benchmark{" "}
          <span role="img" aria-label="">
            🧪
          </span>
        </Heading>
        <FormControl display="flex" alignItems="center" marginBottom={4}>
          <FormLabel margin="0" marginRight="4">
            Dataset size (n):
          </FormLabel>
          <NumberInput
            min={MIN_DATASET_SIZE}
            flexGrow={1}
            value={datasetSize}
            onChange={handleDatasetSizeChange}
            isDisabled={isLoadingData}
          >
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
        </FormControl>
        <Flex marginBottom={4} alignItems="center">
          <Button
            onClick={runAll}
            colorScheme="orange"
            marginRight={4}
            isLoading={isRunningAll}
          >
            Run all{" "}
            <span role="img" aria-label="run all">
              🔥
            </span>
          </Button>
          {isRunningAll && (
            <Progress
              hasStripe
              isAnimated
              size="sm"
              value={runAllProgress}
              colorScheme="orange"
              w="10%"
              mr={4}
            />
          )}
          <Button onClick={getAllResult}>
            Get JSON result{" "}
            <span role="img" aria-label="copy">
              📄
            </span>
          </Button>
          <FormControl display="flex" alignItems="center" ml="auto" w="unset">
            <FormLabel htmlFor="chart-view" mb="0">
              Chart view:
            </FormLabel>
            <Switch
              id="chart-view"
              isChecked={chartViewModeOn}
              onChange={handleChartViewModeOnChange}
            />
          </FormControl>
        </Flex>
        <Grid width="100%" templateColumns="repeat(2, 1fr)" gap={8}>
          <GridItem>
            <SingleReadWriteTable
              datasetSize={datasetSize}
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
          <GridItem>
            <ReadByRangeTable
              datasetSize={datasetSize}
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
          <GridItem>
            <ReadAllTable
              datasetSize={datasetSize}
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
          <GridItem>
            <ReadFromTheEndOfSourceDataTable
              datasetSize={datasetSize}
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
          <GridItem>
            <ReadByIndexTable
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
          <GridItem>
            <ReadByLimitTable
              addLog={addLog}
              removeLog={removeLog}
              chartViewModeOn={chartViewModeOn}
            />
          </GridItem>
        </Grid>
      </Container>
      <Flex
        height="68px"
        overflowY="auto"
        backgroundColor="gray.600"
        boxShadow="0px -7px 0px var(--chakra-colors-gray-200)"
        padding={4}
        position="fixed"
        bottom="0"
        zIndex={2}
      >
        <Text fontSize={14} marginRight={2} fontWeight={600} color="white">
          <span role="img" aria-label="">
            📃
          </span>{" "}
          Log:
        </Text>
        <Flex direction="column" gap="5px">
          {logs.map(({ id, content }) => (
            <Text key={id} fontSize={14} color="white">
              {content}
            </Text>
          ))}
        </Flex>
      </Flex>
      {prepareDataProgress !== 0 && (
        <Flex
          height="68px"
          backgroundColor="purple.600"
          boxShadow="0px -7px 0px var(--chakra-colors-purple-200)"
          padding={4}
          position="fixed"
          bottom="0"
          right="0"
          zIndex={2}
          alignItems="baseline"
        >
          <Text fontSize={14} marginRight={2} fontWeight={600} color="white">
            <span role="img" aria-label="">
              💾
            </span>{" "}
            Prepare data:
          </Text>
          <Progress
            hasStripe
            isAnimated
            size="sm"
            w="100px"
            colorScheme="pink"
            value={prepareDataProgress}
            max={datasetSize}
          />
        </Flex>
      )}
    </>
  );
}

export default App;
